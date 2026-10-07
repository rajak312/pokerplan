'use client';

import { DECKS } from '@pokerplan/shared';
import { History } from 'lucide-react';
import Link from 'next/link';
import { LogoMark } from '@/components/logo';
import { ThemeToggle } from '@/components/theme';
import { cn } from '@/lib/cn';
import { useRoomStore } from '@/lib/room-store';
import { InviteButton } from './invite-button';
import { ShortcutsButton } from './shortcuts-help';

export function RoomHeader() {
  const room = useRoomStore((s) => s.state!.room);
  const connection = useRoomStore((s) => s.connection);
  const online = useRoomStore((s) => s.state!.participants.filter((p) => p.isOnline).length);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-5">
        <Link href="/" aria-label="PokerPlan home" className="shrink-0 rounded-lg">
          <LogoMark className="size-8" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] leading-tight font-semibold">{room.name}</h1>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <span
                className={cn(
                  'size-2 rounded-full',
                  connection === 'connected' ? 'bg-success' : 'animate-pulse-soft bg-warning',
                )}
                aria-hidden
              />
              {connection === 'connected' ? `${online} online` : 'Reconnecting…'}
            </span>
            <span aria-hidden className="hidden text-subtle sm:inline">
              ·
            </span>
            <span className="hidden truncate sm:inline">{DECKS[room.deck].label}</span>
          </div>
        </div>
        <nav className="flex items-center gap-1 sm:gap-1.5" aria-label="Room">
          <ShortcutsButton />
          <Link
            href={`/r/${room.id}/summary`}
            className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm text-muted transition hover:bg-surface-2 hover:text-fg"
            title="Session history & export"
          >
            <History className="size-4" />
            <span className="hidden md:inline">History</span>
          </Link>
          <ThemeToggle />
          <InviteButton roomId={room.id} size="sm" className="ml-1" />
        </nav>
      </div>
    </header>
  );
}
