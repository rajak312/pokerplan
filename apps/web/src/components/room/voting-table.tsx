'use client';

import type { ParticipantDTO } from '@pokerplan/shared';
import { Check, Crown, UserPlus } from 'lucide-react';
import { Panel } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { selectIsFacilitator, useRoomStore } from '@/lib/room-store';
import { InviteButton } from './invite-button';

export function VotingTable() {
  const state = useRoomStore((s) => s.state!);
  const isFacilitator = useRoomStore(selectIsFacilitator);
  const round = state.round;
  const revealed = round?.revealed ?? false;
  const stats = round?.stats ?? null;
  const voters = state.participants.filter((p) => !p.isSpectator && (p.isOnline || p.hasVoted));
  const voted = voters.filter((p) => p.hasVoted).length;
  const everyoneVoted = voters.length > 0 && voted === voters.length;
  const outliers = new Set(stats?.outlierIds ?? []);

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
        <p className="text-sm font-medium" aria-live="polite">
          {revealed ? (
            <span>Cards revealed</span>
          ) : everyoneVoted ? (
            <span className="text-success">
              Everyone has voted{isFacilitator ? ' — reveal when ready' : ''}
            </span>
          ) : (
            <span>
              <span className="tabular-nums">{voted}</span> of{' '}
              <span className="tabular-nums">{voters.length}</span> voted
            </span>
          )}
        </p>
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-3 sm:w-48" aria-hidden>
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              everyoneVoted || revealed ? 'bg-success' : 'bg-primary',
            )}
            style={{ width: `${voters.length ? (voted / voters.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="relative bg-[radial-gradient(ellipse_at_center,var(--surface-2),var(--surface))] px-4 py-7 sm:px-8 sm:py-8">
        {voters.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            Everyone is spectating. Switch to voter mode to play a card.
          </p>
        ) : (
          <ul
            className="flex flex-wrap justify-center gap-x-5 gap-y-7 sm:gap-x-7"
            aria-label="Table"
          >
            {voters.map((p, i) => (
              <Seat
                key={p.id}
                participant={p}
                isMe={p.id === state.me.participantId}
                revealed={revealed}
                index={i}
                outlier={outliers.has(p.id)}
                consensus={Boolean(stats?.consensus)}
              />
            ))}
          </ul>
        )}

        {state.participants.length === 1 && (
          <div className="mx-auto mt-7 flex max-w-lg animate-fade-in flex-col items-center gap-4 rounded-2xl border border-dashed border-border-strong bg-surface/70 px-5 py-4 text-center sm:flex-row sm:text-left">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <UserPlus className="size-5" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-semibold">It&apos;s quiet in here</p>
              <p className="mt-0.5 text-sm text-muted">
                Share the invite link — teammates join instantly, no sign-up.
              </p>
            </div>
            <InviteButton
              roomId={state.room.id}
              label="Copy invite link"
              size="sm"
              variant="secondary"
            />
          </div>
        )}
      </div>
    </Panel>
  );
}

function Seat({
  participant: p,
  isMe,
  revealed,
  index,
  outlier,
  consensus,
}: {
  participant: ParticipantDTO;
  isMe: boolean;
  revealed: boolean;
  index: number;
  outlier: boolean;
  consensus: boolean;
}) {
  // Your own card is face-up as soon as you vote; everyone else's flips on reveal.
  const faceUp = p.hasVoted && (revealed || isMe);
  const status = revealed
    ? p.vote
      ? `voted ${p.vote}`
      : 'did not vote'
    : p.hasVoted
      ? 'has voted'
      : 'is thinking';

  return (
    <li
      className="flex w-[76px] flex-col items-center gap-2.5 sm:w-20"
      aria-label={`${p.name}${isMe ? ' (you)' : ''} ${status}`}
    >
      <div
        className="flip h-[104px] w-[72px] sm:h-[112px] sm:w-[78px]"
        data-flipped={faceUp}
        style={
          { '--flip-delay': revealed && !isMe ? `${index * 70}ms` : '0ms' } as React.CSSProperties
        }
      >
        <div className="flip-inner">
          {/* Back (or empty slot) */}
          <div
            className={cn(
              'flip-face flex items-center justify-center rounded-xl',
              p.hasVoted
                ? 'card-back animate-pop shadow-card ring-1 ring-white/10'
                : 'border-2 border-dashed border-border-strong bg-surface/40',
            )}
          >
            {p.hasVoted ? (
              <Check className="size-6 text-white/90" strokeWidth={2.5} />
            ) : (
              <span className="flex gap-1" aria-hidden>
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className={cn(
                      'size-1.5 rounded-full bg-subtle',
                      p.isOnline && !revealed && 'animate-pulse-soft',
                    )}
                    style={{ animationDelay: `${d * 200}ms` }}
                  />
                ))}
              </span>
            )}
          </div>
          {/* Front */}
          <div
            className={cn(
              'flip-face flip-face-front flex items-center justify-center rounded-xl border-2 bg-surface shadow-card',
              !revealed
                ? 'border-primary/60'
                : outlier
                  ? 'border-warning shadow-[0_0_0_4px_var(--warning-soft)]'
                  : consensus
                    ? 'border-success shadow-[0_0_0_4px_var(--success-soft)]'
                    : 'border-border-strong',
            )}
          >
            <span
              className={cn(
                'font-bold tracking-tight',
                (p.vote?.length ?? 0) > 2 ? 'text-xl' : 'text-3xl',
                !revealed
                  ? 'text-primary'
                  : outlier
                    ? 'text-warning'
                    : consensus
                      ? 'text-success'
                      : 'text-fg',
              )}
            >
              {p.vote}
            </span>
          </div>
        </div>
      </div>
      <div className="flex w-full flex-col items-center">
        <span
          className={cn(
            'flex max-w-full items-center gap-1 text-[13px] font-medium',
            !p.isOnline && 'text-subtle',
          )}
        >
          {p.isFacilitator && (
            <Crown className="size-3 shrink-0 text-warning" aria-label="Facilitator" />
          )}
          <span className="truncate">{p.name}</span>
        </span>
        <span className="h-4 text-[11px] text-subtle">
          {isMe ? (
            'You'
          ) : !p.isOnline ? (
            'Offline'
          ) : revealed && outlier ? (
            <span className="font-medium text-warning">Outlier</span>
          ) : (
            ''
          )}
        </span>
      </div>
    </li>
  );
}
