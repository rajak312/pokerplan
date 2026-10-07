import { Injectable } from '@nestjs/common';
import {
  DECKS,
  cardToNumber,
  type CreateRoomPayload,
  type RoomInfo,
  type RoomSummary,
} from '@pokerplan/shared';
import { AppError } from '../common/app-error';
import { generateRoomId, hashToken } from '../common/ids';
import { EstimationService } from '../estimation/estimation.service';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estimation: EstimationService,
  ) {}

  /** Creates a room with an open (story-less) first round. */
  async create(input: CreateRoomPayload): Promise<RoomInfo> {
    const tokenHash = hashToken(input.guestToken);

    for (let attempt = 0; attempt < 5; attempt++) {
      const id = generateRoomId();
      try {
        const room = await this.prisma.$transaction(async (tx) => {
          await tx.room.create({
            data: { id, name: input.name, deck: input.deck, creatorTokenHash: tokenHash },
          });
          const round = await tx.round.create({ data: { roomId: id, number: 1 } });
          let facilitatorId: string | null = null;
          if (input.facilitatorName) {
            const facilitator = await tx.participant.create({
              data: { roomId: id, name: input.facilitatorName, tokenHash },
            });
            facilitatorId = facilitator.id;
          }
          return tx.room.update({
            where: { id },
            data: { currentRoundId: round.id, facilitatorId },
          });
        });
        return {
          id: room.id,
          name: room.name,
          deck: room.deck,
          createdAt: room.createdAt.toISOString(),
          participantCount: input.facilitatorName ? 1 : 0,
          storyCount: 0,
        };
      } catch (error) {
        // Astronomically unlikely id collision — retry with a fresh id.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
          continue;
        throw error;
      }
    }
    throw new AppError('INTERNAL', 'Could not allocate a room id, please try again');
  }

  async getInfo(roomId: string): Promise<RoomInfo> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        _count: { select: { stories: true, participants: { where: { removedAt: null } } } },
      },
    });
    if (!room) throw AppError.notFound();
    return {
      id: room.id,
      name: room.name,
      deck: room.deck,
      createdAt: room.createdAt.toISOString(),
      participantCount: room._count.participants,
      storyCount: room._count.stories,
    };
  }

  /** Everything needed for the history page and CSV export. */
  async getSummary(roomId: string): Promise<RoomSummary> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        participants: { orderBy: { createdAt: 'asc' } },
        stories: {
          orderBy: { position: 'asc' },
          include: {
            rounds: {
              orderBy: { number: 'asc' },
              include: { votes: { include: { participant: { select: { name: true } } } } },
            },
          },
        },
      },
    });
    if (!room) throw AppError.notFound();

    const stories = room.stories.map((story) => ({
      id: story.id,
      title: story.title,
      description: story.description,
      link: story.link,
      position: story.position,
      status: story.status,
      finalEstimate: story.finalEstimate,
      estimatedAt: story.estimatedAt?.toISOString() ?? null,
      rounds: story.rounds
        .filter((r) => r.revealedAt !== null)
        .map((r) => ({
          id: r.id,
          number: r.number,
          revealedAt: r.revealedAt?.toISOString() ?? null,
          votes: r.votes
            .slice()
            .sort((a, b) => a.participant.name.localeCompare(b.participant.name))
            .map((v) => ({ participantName: v.participant.name, value: v.value })),
          stats: this.estimation.compute(room.deck, r.votes),
        })),
    }));

    const estimated = stories.filter((s) => s.finalEstimate !== null);
    const numeric = DECKS[room.deck].numeric;
    const points = numeric
      ? estimated.reduce((sum, s) => sum + (cardToNumber(s.finalEstimate ?? '') ?? 0), 0)
      : null;

    return {
      room: {
        id: room.id,
        name: room.name,
        deck: room.deck,
        createdAt: room.createdAt.toISOString(),
      },
      participants: room.participants.map((p) => ({ id: p.id, name: p.name })),
      stories,
      totals: {
        stories: stories.length,
        estimated: estimated.length,
        points,
        rounds: stories.reduce((n, s) => n + s.rounds.length, 0),
      },
    };
  }
}
