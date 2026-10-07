'use client';

import { TIMER_PRESETS } from '@pokerplan/shared';
import { Timer, TimerOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Menu } from '@/components/ui/menu';
import { cn } from '@/lib/cn';
import { formatCountdown, formatDuration } from '@/lib/format';
import { roomActions } from '@/lib/room-actions';
import { selectIsFacilitator, useRoomStore } from '@/lib/room-store';

/** Remaining ms of the round timer in *server* time; re-renders 4×/s while running. */
function useRemaining(endsAt: number | null, clockOffset: number): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);
  return endsAt === null ? null : Math.max(0, endsAt - (now + clockOffset));
}

export function RoundTimer() {
  const timer = useRoomStore((s) => s.state!.timer);
  const revealed = useRoomStore((s) => s.state!.round?.revealed ?? false);
  const clockOffset = useRoomStore((s) => s.clockOffset);
  const isFacilitator = useRoomStore(selectIsFacilitator);
  const remaining = useRemaining(timer?.endsAt ?? null, clockOffset);

  if (timer && remaining !== null) {
    const urgent = remaining <= 10_000;
    const progress = Math.min(1, remaining / (timer.durationSec * 1000));
    return (
      <div
        className={cn(
          'relative inline-flex h-9 items-center gap-2 overflow-hidden rounded-lg border px-3 font-mono text-sm font-semibold tabular-nums',
          urgent
            ? 'border-danger/40 bg-danger-soft text-danger'
            : 'border-border bg-surface-2 text-fg',
        )}
        role="timer"
        aria-live="off"
        aria-label={`Time left ${formatCountdown(remaining)}`}
      >
        <span
          className={cn(
            'absolute bottom-0 left-0 h-0.5 transition-[width] duration-300 ease-linear',
            urgent ? 'bg-danger' : 'bg-primary',
          )}
          style={{ width: `${progress * 100}%` }}
          aria-hidden
        />
        <Timer className={cn('relative size-4', urgent && 'animate-pulse-soft')} />
        <span className="relative">{formatCountdown(remaining)}</span>
        {isFacilitator && (
          <button
            type="button"
            onClick={() => void roomActions.stopTimer()}
            className="relative -mr-1 rounded p-0.5 text-muted transition hover:text-fg"
            aria-label="Stop timer"
            title="Stop timer"
          >
            <TimerOff className="size-3.5" />
          </button>
        )}
      </div>
    );
  }

  if (!isFacilitator || revealed) return null;
  return (
    <Menu
      align="end"
      trigger={(p) => (
        <button
          {...p}
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-muted shadow-xs transition hover:border-border-strong hover:text-fg"
          title="Start a round timer"
        >
          <Timer className="size-4" />
          <span className="hidden sm:inline">Timer</span>
        </button>
      )}
      items={TIMER_PRESETS.map((sec) => ({
        label: `${formatDuration(sec)} — auto-reveal`,
        onSelect: () => void roomActions.startTimer(sec),
      }))}
    />
  );
}
