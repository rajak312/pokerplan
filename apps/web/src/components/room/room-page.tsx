'use client';

import { ROOM_ID_PATTERN } from '@pokerplan/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ApiError, api, queryKeys } from '@/lib/api';
import { useRoomStore } from '@/lib/room-store';
import { useRoomConnection } from '@/lib/use-room-connection';
import { JoinForm } from './join-form';
import { RoomView } from './room-view';
import { FullPageMessage, RoomSkeleton } from './states';

export function RoomPage({ roomId }: { roomId: string }) {
  const validId = ROOM_ID_PATTERN.test(roomId);
  if (!validId) return <FullPageMessage kind="not-found" />;
  return <ValidRoomPage roomId={roomId} />;
}

function ValidRoomPage({ roomId }: { roomId: string }) {
  const info = useQuery({ queryKey: queryKeys.room(roomId), queryFn: () => api.getRoom(roomId) });
  const { joinWithName } = useRoomConnection(roomId);
  const join = useRoomStore((s) => s.join);
  const joinError = useRoomStore((s) => s.joinError);
  const hasState = useRoomStore((s) => s.state?.room.id === roomId);
  const connection = useRoomStore((s) => s.connection);
  const slowStart = useSlowStart(connection === 'connecting' && !hasState);

  const roomName = info.data?.name;
  useEffect(() => {
    if (roomName) document.title = `${roomName} · PokerPlan`;
  }, [roomName]);

  const notFound =
    join === 'not-found' || (info.error instanceof ApiError && info.error.status === 404);
  if (notFound) return <FullPageMessage kind="not-found" />;
  if (join === 'removed') return <FullPageMessage kind="removed" detail={joinError ?? undefined} />;
  if (join === 'error') return <FullPageMessage kind="error" detail={joinError ?? undefined} />;
  if (join === 'needs-name') return <JoinForm info={info.data} onJoin={joinWithName} />;
  if (join === 'joined' && hasState) return <RoomView />;
  return <RoomSkeleton slowStart={slowStart} />;
}

/** After a few seconds without a connection, explain that a free-tier server may be waking up. */
function useSlowStart(active: boolean): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setSlow(true), 4000);
    return () => {
      clearTimeout(t);
      setSlow(false);
    };
  }, [active]);
  return slow;
}
