import { Injectable } from '@nestjs/common';
import {
  isValidCard,
  isSpecialCard,
  type FinalizePayload,
  type ParticipantDTO,
  type RoomStateDTO,
  type StoryInput,
  type UpdateStoryPayload,
} from '@pokerplan/shared';
import { AppError } from '../common/app-error';
import { EstimationService } from '../estimation/estimation.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Who is performing an action. */
export interface ActorContext {
  roomId: string;
  participantId: string;
}

type Tx = Prisma.TransactionClient;

const roomInclude = {
  participants: { where: { removedAt: null }, orderBy: { createdAt: 'asc' } },
  stories: { orderBy: { position: 'asc' } },
  currentRound: { include: { votes: true } },
} satisfies Prisma.RoomInclude;

export type RoomData = Prisma.RoomGetPayload<{ include: typeof roomInclude }>;

let lastVersion = 0;
function nextVersion(): number {
  lastVersion = Math.max(Date.now(), lastVersion + 1);
  return lastVersion;
}

/**
 * All live-session business rules. Every method is safe to call repeatedly with the same
 * payload (idempotent): actions that refer to a round/story that is no longer current
 * become no-ops instead of corrupting state.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estimation: EstimationService,
  ) {}

  /* ---------------------------------------------------------------- */
  /* Reading                                                           */
  /* ---------------------------------------------------------------- */

  async loadRoom(roomId: string, db: Tx | PrismaService = this.prisma): Promise<RoomData> {
    const room = await db.room.findUnique({ where: { id: roomId }, include: roomInclude });
    if (!room) throw AppError.notFound();
    return room;
  }

  /** Builds the snapshot for one viewer — other people's votes stay hidden until reveal. */
  buildState(
    room: RoomData,
    viewerId: string,
    isOnline: (participantId: string) => boolean,
  ): RoomStateDTO {
    const round = room.currentRound;
    const revealed = Boolean(round?.revealedAt);
    const votes = new Map(round?.votes.map((v) => [v.participantId, v.value]) ?? []);

    const participants: ParticipantDTO[] = room.participants.map((p) => ({
      id: p.id,
      name: p.name,
      isFacilitator: p.id === room.facilitatorId,
      isSpectator: p.isSpectator,
      isOnline: isOnline(p.id),
      hasVoted: votes.has(p.id),
      vote: revealed || p.id === viewerId ? (votes.get(p.id) ?? null) : null,
      joinedAt: p.createdAt.toISOString(),
    }));

    const timerActive = room.timerEndsAt && room.timerDurationSec;
    return {
      version: nextVersion(),
      serverNow: Date.now(),
      room: {
        id: room.id,
        name: room.name,
        deck: room.deck,
        facilitatorId: room.facilitatorId,
        createdAt: room.createdAt.toISOString(),
      },
      me: { participantId: viewerId },
      participants,
      stories: room.stories.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        link: s.link,
        position: s.position,
        status: s.status,
        finalEstimate: s.finalEstimate,
        estimatedAt: s.estimatedAt?.toISOString() ?? null,
      })),
      currentStoryId: round?.storyId ?? null,
      round: round
        ? {
            id: round.id,
            number: round.number,
            storyId: round.storyId,
            revealed,
            revealedAt: round.revealedAt?.toISOString() ?? null,
            stats: revealed ? this.estimation.compute(room.deck, round.votes) : null,
          }
        : null,
      timer: timerActive
        ? { endsAt: room.timerEndsAt!.getTime(), durationSec: room.timerDurationSec! }
        : null,
    };
  }

  /* ---------------------------------------------------------------- */
  /* Membership                                                        */
  /* ---------------------------------------------------------------- */

  /** Finds or creates the guest's seat. The same token always maps to the same seat. */
  async join(
    roomId: string,
    tokenHash: string,
    name?: string,
  ): Promise<{ participantId: string; isNew: boolean }> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw AppError.notFound();

    let participant = await this.prisma.participant.findUnique({
      where: { roomId_tokenHash: { roomId, tokenHash } },
    });
    if (participant?.removedAt) {
      throw new AppError('REMOVED', 'The facilitator removed you from this room');
    }

    let isNew = false;
    if (participant) {
      participant = await this.prisma.participant.update({
        where: { id: participant.id },
        data: { lastSeenAt: new Date(), ...(name && name !== participant.name ? { name } : {}) },
      });
    } else {
      if (!name) throw new AppError('NAME_REQUIRED', 'Choose a display name to join');
      try {
        participant = await this.prisma.participant.create({ data: { roomId, tokenHash, name } });
        isNew = true;
      } catch (error) {
        // Two tabs joining at the same instant — the other one won, reuse its seat.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          participant = await this.prisma.participant.findUniqueOrThrow({
            where: { roomId_tokenHash: { roomId, tokenHash } },
          });
        } else {
          throw error;
        }
      }
    }

    // The creator claims the facilitator seat on first join.
    if (!room.facilitatorId && room.creatorTokenHash === tokenHash) {
      await this.prisma.room.update({
        where: { id: roomId },
        data: { facilitatorId: participant.id },
      });
    }
    return { participantId: participant.id, isNew };
  }

  async touch(participantId: string): Promise<void> {
    await this.prisma.participant
      .update({ where: { id: participantId }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }

  async setSpectator(ctx: ActorContext, spectator: boolean): Promise<void> {
    const room = await this.loadRoom(ctx.roomId);
    this.requireMember(room, ctx);
    await this.prisma.$transaction(async (tx) => {
      await tx.participant.update({
        where: { id: ctx.participantId },
        data: { isSpectator: spectator },
      });
      if (spectator && room.currentRound && !room.currentRound.revealedAt) {
        await tx.vote.deleteMany({
          where: { roundId: room.currentRound.id, participantId: ctx.participantId },
        });
      }
    });
  }

  async rename(ctx: ActorContext, name: string): Promise<void> {
    const room = await this.loadRoom(ctx.roomId);
    this.requireMember(room, ctx);
    await this.prisma.participant.update({ where: { id: ctx.participantId }, data: { name } });
  }

  async removeParticipant(ctx: ActorContext, targetId: string): Promise<{ name: string }> {
    const room = await this.loadRoom(ctx.roomId);
    this.requireFacilitator(room, ctx);
    if (targetId === ctx.participantId) {
      throw new AppError('CONFLICT', 'Transfer the facilitator role before leaving');
    }
    const target = room.participants.find((p) => p.id === targetId);
    if (!target) throw AppError.notFound('Participant');
    await this.prisma.$transaction(async (tx) => {
      await tx.participant.update({ where: { id: targetId }, data: { removedAt: new Date() } });
      if (room.currentRound && !room.currentRound.revealedAt) {
        await tx.vote.deleteMany({
          where: { roundId: room.currentRound.id, participantId: targetId },
        });
      }
    });
    return { name: target.name };
  }

  async transferFacilitator(ctx: ActorContext, targetId: string): Promise<{ name: string }> {
    const room = await this.loadRoom(ctx.roomId);
    this.requireFacilitator(room, ctx);
    const target = room.participants.find((p) => p.id === targetId);
    if (!target) throw AppError.notFound('Participant');
    if (target.id !== room.facilitatorId) {
      await this.prisma.room.update({ where: { id: room.id }, data: { facilitatorId: target.id } });
    }
    return { name: target.name };
  }

  /**
   * Hands the facilitator role to the longest-present online member (voters before
   * spectators). Used when the facilitator has been offline past the grace period.
   */
  async reassignFacilitator(
    roomId: string,
    isOnline: (participantId: string) => boolean,
  ): Promise<{ name: string } | null> {
    const room = await this.loadRoom(roomId);
    if (room.facilitatorId && isOnline(room.facilitatorId)) return null;
    const online = room.participants.filter((p) => isOnline(p.id));
    const next = online.find((p) => !p.isSpectator) ?? online[0];
    if (!next) return null;
    await this.prisma.room.update({ where: { id: roomId }, data: { facilitatorId: next.id } });
    return { name: next.name };
  }

  /* ---------------------------------------------------------------- */
  /* Voting                                                            */
  /* ---------------------------------------------------------------- */

  async castVote(ctx: ActorContext, roundId: string, value: string | null): Promise<void> {
    const room = await this.loadRoom(ctx.roomId);
    const me = this.requireMember(room, ctx);
    const round = room.currentRound;
    if (!round || round.id !== roundId) {
      throw new AppError('CONFLICT', 'That round is over — your screen has been refreshed');
    }
    if (round.revealedAt) throw new AppError('CONFLICT', 'Cards are already revealed');
    if (me.isSpectator) throw new AppError('FORBIDDEN', 'Spectators cannot vote');

    if (value === null) {
      await this.prisma.vote.deleteMany({ where: { roundId, participantId: me.id } });
      return;
    }
    if (!isValidCard(room.deck, value)) {
      throw new AppError('VALIDATION', `"${value}" is not a card in this deck`);
    }
    await this.prisma.vote.upsert({
      where: { roundId_participantId: { roundId, participantId: me.id } },
      create: { roundId, participantId: me.id, value },
      update: { value },
    });
  }

  /** Reveals the current round (no-op when it is already revealed or no longer current). */
  async reveal(ctx: ActorContext, roundId: string): Promise<boolean> {
    const room = await this.loadRoom(ctx.roomId);
    this.requireFacilitator(room, ctx);
    const round = room.currentRound;
    if (!round || round.id !== roundId || round.revealedAt) return false;
    await this.prisma.$transaction([
      this.prisma.round.update({ where: { id: roundId }, data: { revealedAt: new Date() } }),
      this.prisma.room.update({
        where: { id: room.id },
        data: { timerEndsAt: null, timerDurationSec: null },
      }),
    ]);
    return true;
  }

  /** Re-vote: clears an unrevealed round, or starts a fresh round for the same story. */
  async resetRound(ctx: ActorContext, roundId: string): Promise<boolean> {
    const room = await this.loadRoom(ctx.roomId);
    this.requireFacilitator(room, ctx);
    const round = room.currentRound;
    if (!round || round.id !== roundId) return false;

    await this.prisma.$transaction(async (tx) => {
      await tx.room.update({
        where: { id: room.id },
        data: { timerEndsAt: null, timerDurationSec: null },
      });
      if (!round.revealedAt) {
        await tx.vote.deleteMany({ where: { roundId } });
        return;
      }
      const next = await tx.round.create({
        data: {
          roomId: room.id,
          storyId: round.storyId,
          number: await this.nextRoundNumber(tx, room.id, round.storyId),
        },
      });
      await tx.room.update({ where: { id: room.id }, data: { currentRoundId: next.id } });
    });
    return true;
  }

  async finalize(
    ctx: ActorContext,
    payload: FinalizePayload,
  ): Promise<{ storyTitle: string; value: string } | null> {
    const room = await this.loadRoom(ctx.roomId);
    this.requireFacilitator(room, ctx);
    const round = room.currentRound;
    if (!round || round.id !== payload.roundId) return null; // already handled
    if (!round.storyId) throw new AppError('CONFLICT', 'Add a story to save estimates');
    if (!round.revealedAt) throw new AppError('CONFLICT', 'Reveal the cards before finalizing');
    if (!isValidCard(room.deck, payload.value) || isSpecialCard(payload.value)) {
      throw new AppError('VALIDATION', `"${payload.value}" is not a valid estimate`);
    }
    const story = room.stories.find((s) => s.id === round.storyId)!;

    await this.prisma.$transaction(async (tx) => {
      await tx.story.update({
        where: { id: story.id },
        data: { finalEstimate: payload.value, estimatedAt: new Date(), status: 'ESTIMATED' },
      });
      if (payload.advance) {
        const fresh = await this.loadRoom(room.id, tx);
        await this.moveTo(tx, fresh, this.pickNextStoryId(fresh));
      }
    });
    return { storyTitle: story.title, value: payload.value };
  }

  /* ---------------------------------------------------------------- */
  /* Stories                                                           */
  /* ---------------------------------------------------------------- */

  async nextStory(ctx: ActorContext, fromStoryId: string | null): Promise<boolean> {
    const room = await this.loadRoom(ctx.roomId);
    this.requireFacilitator(room, ctx);
    if ((room.currentRound?.storyId ?? null) !== fromStoryId) return false; // stale click
    await this.prisma.$transaction((tx) => this.moveTo(tx, room, this.pickNextStoryId(room)));
    return true;
  }

  async selectStory(ctx: ActorContext, storyId: string): Promise<boolean> {
    const room = await this.loadRoom(ctx.roomId);
    this.requireFacilitator(room, ctx);
    if (!room.stories.some((s) => s.id === storyId)) throw AppError.notFound('Story');
    if (room.currentRound?.storyId === storyId) return false;
    await this.prisma.$transaction((tx) => this.moveTo(tx, room, storyId));
    return true;
  }

  async addStories(ctx: ActorContext, stories: StoryInput[]): Promise<number> {
    const room = await this.loadRoom(ctx.roomId);
    this.requireFacilitator(room, ctx);
    const start = (room.stories.at(-1)?.position ?? -1) + 1;

    await this.prisma.$transaction(async (tx) => {
      const created = await tx.story.createManyAndReturn({
        data: stories.map((s, i) => ({
          roomId: room.id,
          title: s.title,
          description: s.description ?? null,
          link: s.link ?? null,
          position: start + i,
        })),
        select: { id: true, position: true },
      });
      // A fresh, untouched story-less round adopts the first new story automatically.
      const round = room.currentRound;
      const first = created.sort((a, b) => a.position - b.position)[0];
      if (round && !round.storyId && !round.revealedAt && round.votes.length === 0 && first) {
        await tx.round.update({
          where: { id: round.id },
          data: { storyId: first.id, number: 1 },
        });
        await tx.story.update({ where: { id: first.id }, data: { status: 'ACTIVE' } });
      }
    });
    return stories.length;
  }

  async updateStory(ctx: ActorContext, payload: UpdateStoryPayload): Promise<void> {
    const room = await this.loadRoom(ctx.roomId);
    this.requireFacilitator(room, ctx);
    if (!room.stories.some((s) => s.id === payload.storyId)) throw AppError.notFound('Story');
    await this.prisma.story.update({
      where: { id: payload.storyId },
      data: {
        title: payload.title,
        description: payload.description ?? null,
        link: payload.link ?? null,
      },
    });
  }

  async deleteStory(ctx: ActorContext, storyId: string): Promise<boolean> {
    const room = await this.loadRoom(ctx.roomId);
    this.requireFacilitator(room, ctx);
    if (!room.stories.some((s) => s.id === storyId)) return false; // already deleted
    await this.prisma.$transaction(async (tx) => {
      if (room.currentRound?.storyId === storyId) {
        const remaining = { ...room, stories: room.stories.filter((s) => s.id !== storyId) };
        await this.moveTo(tx, room, this.pickNextStoryId(remaining));
      }
      await tx.story.delete({ where: { id: storyId } });
    });
    return true;
  }

  async reorderStories(ctx: ActorContext, orderedIds: string[]): Promise<void> {
    const room = await this.loadRoom(ctx.roomId);
    this.requireFacilitator(room, ctx);
    const existing = new Set(room.stories.map((s) => s.id));
    const unique = new Set(orderedIds);
    if (
      unique.size !== orderedIds.length ||
      unique.size !== existing.size ||
      orderedIds.some((id) => !existing.has(id))
    ) {
      throw new AppError('CONFLICT', 'The story list changed — please try again');
    }
    await this.prisma.$transaction(
      orderedIds.map((id, position) =>
        this.prisma.story.update({ where: { id }, data: { position } }),
      ),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Timer                                                             */
  /* ---------------------------------------------------------------- */

  async startTimer(ctx: ActorContext, durationSec: number): Promise<Date> {
    const room = await this.loadRoom(ctx.roomId);
    this.requireFacilitator(room, ctx);
    if (room.currentRound?.revealedAt) {
      throw new AppError('CONFLICT', 'Start a new round before setting a timer');
    }
    const endsAt = new Date(Date.now() + durationSec * 1000);
    await this.prisma.room.update({
      where: { id: room.id },
      data: { timerEndsAt: endsAt, timerDurationSec: durationSec },
    });
    return endsAt;
  }

  async stopTimer(ctx: ActorContext): Promise<void> {
    const room = await this.loadRoom(ctx.roomId);
    this.requireFacilitator(room, ctx);
    await this.prisma.room.update({
      where: { id: room.id },
      data: { timerEndsAt: null, timerDurationSec: null },
    });
  }

  /**
   * Called when a round timer fires. Reveals the round if anyone voted.
   * Returns `null` if the timer was cancelled/rescheduled in the meantime.
   */
  async expireTimer(roomId: string): Promise<{ revealed: boolean } | null> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: { currentRound: { include: { _count: { select: { votes: true } } } } },
    });
    if (!room?.timerEndsAt || room.timerEndsAt.getTime() > Date.now() + 250) return null;
    const round = room.currentRound;
    const reveal = Boolean(round && !round.revealedAt && round._count.votes > 0);
    await this.prisma.$transaction([
      this.prisma.room.update({
        where: { id: roomId },
        data: { timerEndsAt: null, timerDurationSec: null },
      }),
      ...(reveal && round
        ? [this.prisma.round.update({ where: { id: round.id }, data: { revealedAt: new Date() } })]
        : []),
    ]);
    return { revealed: reveal };
  }

  /** Rooms with timers still running (re-scheduled after a server restart). */
  async pendingTimers(): Promise<{ id: string; timerEndsAt: Date }[]> {
    const rooms = await this.prisma.room.findMany({
      where: { timerEndsAt: { not: null } },
      select: { id: true, timerEndsAt: true },
    });
    return rooms.flatMap((r) => (r.timerEndsAt ? [{ id: r.id, timerEndsAt: r.timerEndsAt }] : []));
  }

  /* ---------------------------------------------------------------- */
  /* Internals                                                         */
  /* ---------------------------------------------------------------- */

  private requireMember(room: RoomData, ctx: ActorContext) {
    const me = room.participants.find((p) => p.id === ctx.participantId);
    if (!me) throw new AppError('REMOVED', 'You are no longer part of this room');
    return me;
  }

  private requireFacilitator(room: RoomData, ctx: ActorContext) {
    const me = this.requireMember(room, ctx);
    if (room.facilitatorId !== me.id) throw AppError.forbidden();
    return me;
  }

  /** Next pending story after the current one, wrapping around to earlier skipped stories. */
  private pickNextStoryId(room: Pick<RoomData, 'stories' | 'currentRound'>): string | null {
    const currentId = room.currentRound?.storyId ?? null;
    const current = room.stories.find((s) => s.id === currentId);
    const pending = room.stories.filter((s) => s.id !== currentId && s.status !== 'ESTIMATED');
    const after = current ? pending.find((s) => s.position > current.position) : pending[0];
    return (after ?? pending[0])?.id ?? null;
  }

  /** Makes `storyId` (or a free, story-less round when `null`) the current round. */
  private async moveTo(tx: Tx, room: RoomData, storyId: string | null): Promise<void> {
    const leaving = room.currentRound?.storyId;
    if (leaving && leaving !== storyId) {
      await tx.story.updateMany({
        where: { id: leaving, status: 'ACTIVE' },
        data: { status: 'PENDING' },
      });
    }
    if (storyId) {
      await tx.story.updateMany({
        where: { id: storyId, status: { not: 'ESTIMATED' } },
        data: { status: 'ACTIVE' },
      });
    }
    const round = await tx.round.create({
      data: {
        roomId: room.id,
        storyId,
        number: await this.nextRoundNumber(tx, room.id, storyId),
      },
    });
    await tx.room.update({
      where: { id: room.id },
      data: { currentRoundId: round.id, timerEndsAt: null, timerDurationSec: null },
    });
  }

  private async nextRoundNumber(tx: Tx, roomId: string, storyId: string | null): Promise<number> {
    const count = await tx.round.count({ where: { roomId, storyId } });
    return count + 1;
  }
}
