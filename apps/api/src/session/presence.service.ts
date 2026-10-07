import { Injectable } from '@nestjs/common';

/**
 * In-memory presence: which sockets belong to which participant in which room.
 * A participant is online while at least one of their tabs is connected.
 *
 * Note: this is per-process. Running several API instances would require moving this
 * (and Socket.IO fan-out) to Redis via `@socket.io/redis-adapter`.
 */
@Injectable()
export class PresenceService {
  private readonly rooms = new Map<string, Map<string, Set<string>>>();

  /** Returns true when the participant just came online. */
  add(roomId: string, participantId: string, socketId: string): boolean {
    const room = this.rooms.get(roomId) ?? new Map<string, Set<string>>();
    this.rooms.set(roomId, room);
    const sockets = room.get(participantId) ?? new Set<string>();
    room.set(participantId, sockets);
    const wasOnline = sockets.size > 0;
    sockets.add(socketId);
    return !wasOnline;
  }

  /** Returns true when the participant just went offline. */
  remove(roomId: string, participantId: string, socketId: string): boolean {
    const room = this.rooms.get(roomId);
    const sockets = room?.get(participantId);
    if (!room || !sockets?.delete(socketId)) return false;
    if (sockets.size > 0) return false;
    room.delete(participantId);
    if (room.size === 0) this.rooms.delete(roomId);
    return true;
  }

  /** Drops every socket of a participant (used when they are removed). */
  evict(roomId: string, participantId: string): string[] {
    const room = this.rooms.get(roomId);
    const sockets = [...(room?.get(participantId) ?? [])];
    room?.delete(participantId);
    if (room?.size === 0) this.rooms.delete(roomId);
    return sockets;
  }

  isOnline(roomId: string, participantId: string): boolean {
    return (this.rooms.get(roomId)?.get(participantId)?.size ?? 0) > 0;
  }

  checker(roomId: string): (participantId: string) => boolean {
    return (participantId) => this.isOnline(roomId, participantId);
  }
}
