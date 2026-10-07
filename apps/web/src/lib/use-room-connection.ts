'use client';

import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { saveName } from './guest';
import { setActiveSocket } from './room-actions';
import { useRoomStore } from './room-store';
import { createSocket, emitWithAck, type AppSocket } from './socket';

/**
 * Owns the Socket.IO connection for a room page.
 *
 * - (Re)joins on every connect, so reconnects resync the full state from the server.
 * - The guest token in the handshake maps to the same seat, so no name is needed again.
 */
export function useRoomConnection(roomId: string): {
  joinWithName: (name: string) => Promise<boolean>;
} {
  const socketRef = useRef<AppSocket | null>(null);

  const join = useCallback(
    async (name?: string): Promise<boolean> => {
      const socket = socketRef.current;
      if (!socket) return false;
      const store = useRoomStore.getState();
      const ack = await emitWithAck(socket, 'room:join', { roomId, name });
      if (ack.ok) {
        store.applyState(ack.data.state);
        store.setJoin('joined');
        if (name) saveName(name);
        return true;
      }
      switch (ack.error.code) {
        case 'NAME_REQUIRED':
          store.setJoin('needs-name');
          break;
        case 'NOT_FOUND':
          store.setJoin('not-found');
          break;
        case 'REMOVED':
          store.setJoin('removed', ack.error.message);
          break;
        case 'VALIDATION':
          // Keep the name form open so the user can fix their input.
          toast.error(ack.error.message);
          if (store.join !== 'joined') store.setJoin('needs-name');
          break;
        default:
          store.setJoin('error', ack.error.message);
      }
      return false;
    },
    [roomId],
  );

  useEffect(() => {
    const store = useRoomStore.getState();
    store.reset(roomId);
    const socket = createSocket();
    socketRef.current = socket;
    setActiveSocket(socket);

    socket.on('connect', () => {
      useRoomStore.getState().setConnection('connected');
      void join();
    });
    socket.on('disconnect', (reason) => {
      if (reason !== 'io client disconnect') useRoomStore.getState().setConnection('reconnecting');
    });
    socket.on('connect_error', () => {
      const s = useRoomStore.getState();
      s.setConnection(s.everConnected ? 'reconnecting' : 'connecting');
    });
    socket.on('room:state', (state) => useRoomStore.getState().applyState(state));
    socket.on('room:notice', (notice) => {
      const show =
        notice.kind === 'success'
          ? toast.success
          : notice.kind === 'warning'
            ? toast.warning
            : toast.info;
      show(notice.message);
    });
    socket.on('room:removed', ({ reason }) => {
      useRoomStore.getState().setJoin('removed', reason);
      socket.disconnect();
    });

    socket.connect();
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      setActiveSocket(null);
      socketRef.current = null;
    };
  }, [roomId, join]);

  return { joinWithName: join };
}
