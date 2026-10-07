'use client';

import { WifiOff } from 'lucide-react';
import { useRoomStore } from '@/lib/room-store';

export function ConnectionBanner() {
  const connection = useRoomStore((s) => s.connection);
  if (connection === 'connected') return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning-soft px-4 py-2 text-sm font-medium text-warning"
    >
      <WifiOff className="size-4 animate-pulse-soft" />
      Connection lost — reconnecting. Your seat and vote are safe.
    </div>
  );
}
