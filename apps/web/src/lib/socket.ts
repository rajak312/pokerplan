import type {
  Ack,
  ClientEventName,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@pokerplan/shared';
import { io, type Socket } from 'socket.io-client';
import { API_URL } from './env';
import { getGuestToken } from './guest';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createSocket(): AppSocket {
  return io(API_URL, {
    auth: { token: getGuestToken() },
    transports: ['websocket', 'polling'],
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    autoConnect: false,
  });
}

type PayloadOf<E extends ClientEventName> = Parameters<ClientToServerEvents[E]>[0];
type AckOf<E extends ClientEventName> = Parameters<Parameters<ClientToServerEvents[E]>[1]>[0];

/** Emits a typed event and resolves with its acknowledgement (or a timeout error ack). */
export function emitWithAck<E extends ClientEventName>(
  socket: AppSocket,
  event: E,
  payload: PayloadOf<E>,
  timeoutMs = 8000,
): Promise<AckOf<E>> {
  return new Promise((resolve) => {
    // socket.io's typed `emit` can't infer generic event names, so we widen it once here.
    const timed = socket.timeout(timeoutMs) as unknown as {
      emit: (e: string, p: unknown, cb: (err: Error | null, res: unknown) => void) => void;
    };
    timed.emit(event, payload, (err, res) => {
      if (err) {
        const timeout: Ack<never> = {
          ok: false,
          error: { code: 'INTERNAL', message: 'The server did not respond in time. Please retry.' },
        };
        resolve(timeout as AckOf<E>);
      } else {
        resolve(res as AckOf<E>);
      }
    });
  });
}
