import { Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  addStoriesSchema,
  castVoteSchema,
  finalizeSchema,
  guestTokenSchema,
  joinRoomSchema,
  nextStorySchema,
  participantRefSchema,
  renameSchema,
  reorderStoriesSchema,
  roundActionSchema,
  spectatorSchema,
  startTimerSchema,
  storyRefSchema,
  updateStorySchema,
  type Ack,
  type ClientToServerEvents,
  type NoticePayload,
  type RoomStateDTO,
  type ServerToClientEvents,
} from '@pokerplan/shared';
import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { AppError } from '../common/app-error';
import { hashToken } from '../common/ids';
import { KeyedMutex } from '../common/keyed-mutex';
import { AppConfig } from '../config/app-config.service';
import { PresenceService } from './presence.service';
import { type ActorContext, type RoomData, SessionService } from './session.service';
import { SocketRateLimiter } from './socket-rate-limiter';

interface SocketData {
  tokenHash: string;
  roomId?: string;
  participantId?: string;
}

type IoServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
type IoSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const emptySchema = z.object({}).passthrough();

/**
 * Realtime entry point. The server is the single source of truth: every accepted
 * mutation is followed by a fresh, per-viewer snapshot broadcast to the whole room.
 */
@WebSocketGateway({ transports: ['websocket', 'polling'] })
export class SessionGateway
  implements OnGatewayInit, OnGatewayDisconnect, OnApplicationBootstrap, OnModuleDestroy
{
  @WebSocketServer() private server!: IoServer;

  private readonly logger = new Logger(SessionGateway.name);
  private readonly mutex = new KeyedMutex();
  private readonly limiter = new SocketRateLimiter();
  private readonly roundTimers = new Map<string, NodeJS.Timeout>();
  private readonly facilitatorTimers = new Map<string, NodeJS.Timeout>();
  private shuttingDown = false;

  constructor(
    private readonly session: SessionService,
    private readonly presence: PresenceService,
    private readonly config: AppConfig,
  ) {}

  /* ---------------------------------------------------------------- */
  /* Lifecycle                                                         */
  /* ---------------------------------------------------------------- */

  afterInit(server: IoServer): void {
    // Every connection must present a guest token; only its hash is kept.
    server.use((socket, next) => {
      const auth = socket.handshake.auth as { token?: unknown };
      const token = guestTokenSchema.safeParse(auth.token);
      if (!token.success) return next(new Error('A guest token is required'));
      socket.data.tokenHash = hashToken(token.data);
      next();
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    // Re-arm round timers that were running before a restart.
    try {
      for (const room of await this.session.pendingTimers()) {
        this.scheduleRoundTimer(room.id, room.timerEndsAt.getTime());
      }
    } catch (error) {
      this.logger.warn(`Could not restore round timers: ${String(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    for (const t of [...this.roundTimers.values(), ...this.facilitatorTimers.values()]) {
      clearTimeout(t);
    }
    await this.mutex.idle();
  }

  handleDisconnect(socket: IoSocket): void {
    this.limiter.forget(socket.id);
    const { roomId, participantId } = socket.data;
    if (!roomId || !participantId || this.shuttingDown) return;
    if (!this.presence.remove(roomId, participantId, socket.id)) return;
    void this.mutex
      .run(roomId, async () => {
        await this.session.touch(participantId);
        await this.broadcast(roomId);
      })
      .catch((error: unknown) => this.logger.error(`disconnect sync failed: ${String(error)}`));
  }

  /* ---------------------------------------------------------------- */
  /* Membership                                                        */
  /* ---------------------------------------------------------------- */

  @SubscribeMessage('room:join')
  async onJoin(
    @ConnectedSocket() socket: IoSocket,
    @MessageBody() body: unknown,
  ): Promise<Ack<{ participantId: string; state: RoomStateDTO }>> {
    return this.guard(socket, async () => {
      const { roomId, name } = joinRoomSchema.parse(body);
      // A socket lives in at most one room.
      if (socket.data.roomId && socket.data.roomId !== roomId) this.detach(socket);

      return this.mutex.run(roomId, async () => {
        const { participantId } = await this.session.join(roomId, socket.data.tokenHash, name);
        socket.data.roomId = roomId;
        socket.data.participantId = participantId;
        await socket.join(roomId);
        this.presence.add(roomId, participantId, socket.id);
        const room = await this.broadcast(roomId);
        return {
          participantId,
          state: this.session.buildState(room, participantId, this.presence.checker(roomId)),
        };
      });
    });
  }

  @SubscribeMessage('room:sync')
  async onSync(@ConnectedSocket() socket: IoSocket): Promise<Ack<RoomStateDTO>> {
    return this.guard(socket, async () => {
      const ctx = this.ctx(socket);
      const room = await this.session.loadRoom(ctx.roomId);
      return this.session.buildState(room, ctx.participantId, this.presence.checker(ctx.roomId));
    });
  }

  @SubscribeMessage('participant:spectator')
  onSpectator(@ConnectedSocket() socket: IoSocket, @MessageBody() body: unknown): Promise<Ack> {
    return this.mutate(socket, (ctx) =>
      this.session.setSpectator(ctx, spectatorSchema.parse(body).spectator),
    );
  }

  @SubscribeMessage('participant:rename')
  onRename(@ConnectedSocket() socket: IoSocket, @MessageBody() body: unknown): Promise<Ack> {
    return this.mutate(socket, (ctx) => this.session.rename(ctx, renameSchema.parse(body).name));
  }

  @SubscribeMessage('participant:remove')
  onRemove(@ConnectedSocket() socket: IoSocket, @MessageBody() body: unknown): Promise<Ack> {
    return this.mutate(socket, async (ctx) => {
      const { participantId } = participantRefSchema.parse(body);
      const { name } = await this.session.removeParticipant(ctx, participantId);
      const socketIds = this.presence.evict(ctx.roomId, participantId);
      for (const id of socketIds) {
        const target = this.server.sockets.sockets.get(id);
        if (!target) continue;
        target.emit('room:removed', { reason: 'The facilitator removed you from this room' });
        void target.leave(ctx.roomId);
        target.data.roomId = undefined;
        target.data.participantId = undefined;
      }
      this.notify(ctx.roomId, { kind: 'info', message: `${name} was removed from the room` });
    });
  }

  @SubscribeMessage('facilitator:transfer')
  onTransfer(@ConnectedSocket() socket: IoSocket, @MessageBody() body: unknown): Promise<Ack> {
    return this.mutate(socket, async (ctx) => {
      const { participantId } = participantRefSchema.parse(body);
      const { name } = await this.session.transferFacilitator(ctx, participantId);
      this.notify(ctx.roomId, { kind: 'info', message: `${name} is now the facilitator` });
    });
  }

  /* ---------------------------------------------------------------- */
  /* Voting                                                            */
  /* ---------------------------------------------------------------- */

  @SubscribeMessage('vote:cast')
  onVote(@ConnectedSocket() socket: IoSocket, @MessageBody() body: unknown): Promise<Ack> {
    return this.mutate(socket, (ctx) => {
      const { roundId, value } = castVoteSchema.parse(body);
      return this.session.castVote(ctx, roundId, value);
    });
  }

  @SubscribeMessage('round:reveal')
  onReveal(@ConnectedSocket() socket: IoSocket, @MessageBody() body: unknown): Promise<Ack> {
    return this.mutate(socket, async (ctx) => {
      if (await this.session.reveal(ctx, roundActionSchema.parse(body).roundId)) {
        this.clearRoundTimer(ctx.roomId);
      }
    });
  }

  @SubscribeMessage('round:reset')
  onReset(@ConnectedSocket() socket: IoSocket, @MessageBody() body: unknown): Promise<Ack> {
    return this.mutate(socket, async (ctx) => {
      if (await this.session.resetRound(ctx, roundActionSchema.parse(body).roundId)) {
        this.clearRoundTimer(ctx.roomId);
      }
    });
  }

  @SubscribeMessage('round:finalize')
  onFinalize(@ConnectedSocket() socket: IoSocket, @MessageBody() body: unknown): Promise<Ack> {
    return this.mutate(socket, async (ctx) => {
      const saved = await this.session.finalize(ctx, finalizeSchema.parse(body));
      if (!saved) return;
      this.clearRoundTimer(ctx.roomId);
      this.notify(ctx.roomId, {
        kind: 'success',
        message: `Saved ${saved.value} for “${saved.storyTitle}”`,
      });
    });
  }

  /* ---------------------------------------------------------------- */
  /* Stories                                                           */
  /* ---------------------------------------------------------------- */

  @SubscribeMessage('story:next')
  onNext(@ConnectedSocket() socket: IoSocket, @MessageBody() body: unknown): Promise<Ack> {
    return this.mutate(socket, async (ctx) => {
      if (await this.session.nextStory(ctx, nextStorySchema.parse(body).fromStoryId)) {
        this.clearRoundTimer(ctx.roomId);
      }
    });
  }

  @SubscribeMessage('story:select')
  onSelect(@ConnectedSocket() socket: IoSocket, @MessageBody() body: unknown): Promise<Ack> {
    return this.mutate(socket, async (ctx) => {
      if (await this.session.selectStory(ctx, storyRefSchema.parse(body).storyId)) {
        this.clearRoundTimer(ctx.roomId);
      }
    });
  }

  @SubscribeMessage('story:add')
  onAddStories(@ConnectedSocket() socket: IoSocket, @MessageBody() body: unknown): Promise<Ack> {
    return this.mutate(socket, async (ctx) => {
      await this.session.addStories(ctx, addStoriesSchema.parse(body).stories);
    });
  }

  @SubscribeMessage('story:update')
  onUpdateStory(@ConnectedSocket() socket: IoSocket, @MessageBody() body: unknown): Promise<Ack> {
    return this.mutate(socket, (ctx) =>
      this.session.updateStory(ctx, updateStorySchema.parse(body)),
    );
  }

  @SubscribeMessage('story:delete')
  onDeleteStory(@ConnectedSocket() socket: IoSocket, @MessageBody() body: unknown): Promise<Ack> {
    return this.mutate(socket, async (ctx) => {
      await this.session.deleteStory(ctx, storyRefSchema.parse(body).storyId);
    });
  }

  @SubscribeMessage('story:reorder')
  onReorder(@ConnectedSocket() socket: IoSocket, @MessageBody() body: unknown): Promise<Ack> {
    return this.mutate(socket, (ctx) =>
      this.session.reorderStories(ctx, reorderStoriesSchema.parse(body).orderedIds),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Timer                                                             */
  /* ---------------------------------------------------------------- */

  @SubscribeMessage('timer:start')
  onTimerStart(@ConnectedSocket() socket: IoSocket, @MessageBody() body: unknown): Promise<Ack> {
    return this.mutate(socket, async (ctx) => {
      const endsAt = await this.session.startTimer(ctx, startTimerSchema.parse(body).durationSec);
      this.scheduleRoundTimer(ctx.roomId, endsAt.getTime());
    });
  }

  @SubscribeMessage('timer:stop')
  onTimerStop(@ConnectedSocket() socket: IoSocket, @MessageBody() body: unknown): Promise<Ack> {
    return this.mutate(socket, async (ctx) => {
      emptySchema.parse(body ?? {});
      await this.session.stopTimer(ctx);
      this.clearRoundTimer(ctx.roomId);
    });
  }

  /* ---------------------------------------------------------------- */
  /* Plumbing                                                          */
  /* ---------------------------------------------------------------- */

  /** Runs a mutation under the room lock, then broadcasts the new state. */
  private mutate(socket: IoSocket, action: (ctx: ActorContext) => Promise<unknown>): Promise<Ack> {
    return this.guard(socket, () => {
      const ctx = this.ctx(socket);
      return this.mutex.run(ctx.roomId, async () => {
        try {
          await action(ctx);
        } finally {
          // Even a rejected action broadcasts, so a stale client is resynced immediately.
          await this.broadcast(ctx.roomId).catch(() => undefined);
        }
        return null;
      });
    });
  }

  /** Converts any thrown error into a typed ack — handlers never throw over the wire. */
  private async guard<T>(socket: IoSocket, fn: () => Promise<T>): Promise<Ack<T>> {
    if (!this.limiter.allow(socket.id)) {
      return { ok: false, error: { code: 'RATE_LIMITED', message: 'Slow down a little' } };
    }
    try {
      return { ok: true, data: await fn() };
    } catch (error) {
      if (error instanceof AppError) return { ok: false, error: error.toAck() };
      if (error instanceof z.ZodError) {
        return {
          ok: false,
          error: { code: 'VALIDATION', message: error.issues[0]?.message ?? 'Invalid input' },
        };
      }
      this.logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
      return { ok: false, error: { code: 'INTERNAL', message: 'Something went wrong' } };
    }
  }

  private ctx(socket: IoSocket): ActorContext {
    const { roomId, participantId } = socket.data;
    if (!roomId || !participantId) throw new AppError('NOT_JOINED', 'Join the room first');
    return { roomId, participantId };
  }

  private detach(socket: IoSocket): void {
    const { roomId, participantId } = socket.data;
    if (!roomId || !participantId) return;
    void socket.leave(roomId);
    if (this.presence.remove(roomId, participantId, socket.id)) {
      void this.mutex.run(roomId, () => this.broadcast(roomId)).catch(() => undefined);
    }
  }

  /** Sends every connected viewer their personalised snapshot. Must run inside the room lock. */
  private async broadcast(roomId: string): Promise<RoomData> {
    const room = await this.session.loadRoom(roomId);
    const isOnline = this.presence.checker(roomId);
    for (const s of await this.server.in(roomId).fetchSockets()) {
      if (s.data.participantId) {
        s.emit('room:state', this.session.buildState(room, s.data.participantId, isOnline));
      }
    }
    this.watchFacilitator(room);
    return room;
  }

  private notify(roomId: string, notice: NoticePayload): void {
    this.server.to(roomId).emit('room:notice', notice);
  }

  /** Hands over the facilitator role if they stay offline past the grace period. */
  private watchFacilitator(room: RoomData): void {
    const online = room.facilitatorId && this.presence.isOnline(room.id, room.facilitatorId);
    const pending = this.facilitatorTimers.get(room.id);
    if (online) {
      if (pending) clearTimeout(pending);
      this.facilitatorTimers.delete(room.id);
      return;
    }
    if (pending) return;
    const timer = setTimeout(() => {
      this.facilitatorTimers.delete(room.id);
      void this.mutex
        .run(room.id, async () => {
          const next = await this.session.reassignFacilitator(
            room.id,
            this.presence.checker(room.id),
          );
          if (!next) return; // nobody online — try again when someone joins
          await this.broadcast(room.id);
          this.notify(room.id, {
            kind: 'info',
            message: room.facilitatorId
              ? `${next.name} is now the facilitator — the previous facilitator went offline`
              : `${next.name} is now the facilitator`,
          });
        })
        .catch((error: unknown) => this.logger.error(`facilitator handover: ${String(error)}`));
    }, this.config.get('FACILITATOR_GRACE_MS'));
    timer.unref();
    this.facilitatorTimers.set(room.id, timer);
  }

  private scheduleRoundTimer(roomId: string, endsAt: number): void {
    this.clearRoundTimer(roomId);
    const timer = setTimeout(
      () => {
        this.roundTimers.delete(roomId);
        void this.mutex
          .run(roomId, async () => {
            const result = await this.session.expireTimer(roomId);
            if (!result) return;
            await this.broadcast(roomId);
            this.notify(roomId, {
              kind: 'info',
              message: result.revealed ? "Time's up — cards revealed" : "Time's up",
            });
          })
          .catch((error: unknown) => this.logger.error(`round timer: ${String(error)}`));
      },
      Math.max(0, endsAt - Date.now()),
    );
    timer.unref();
    this.roundTimers.set(roomId, timer);
  }

  private clearRoundTimer(roomId: string): void {
    const timer = this.roundTimers.get(roomId);
    if (timer) clearTimeout(timer);
    this.roundTimers.delete(roomId);
  }
}
