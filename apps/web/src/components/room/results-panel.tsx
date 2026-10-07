'use client';

import { DECKS, valueCards, type RoundStats } from '@pokerplan/shared';
import { ArrowRight, PartyPopper, Save, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { formatAverage, formatPercent } from '@/lib/format';
import { roomActions } from '@/lib/room-actions';
import { selectCurrentStory, selectIsFacilitator, useRoomStore } from '@/lib/room-store';

export function ResultsPanel() {
  const round = useRoomStore((s) => s.state!.round);
  if (!round?.revealed || !round.stats) return null;
  return <Results key={round.id} roundId={round.id} stats={round.stats} />;
}

function Results({ roundId, stats }: { roundId: string; stats: RoundStats }) {
  const deck = useRoomStore((s) => s.state!.room.deck);
  const participants = useRoomStore((s) => s.state!.participants);
  const nameOf = (id: string) => participants.find((p) => p.id === id)?.name ?? 'Someone';
  const ref = useRef<HTMLDivElement>(null);
  useCelebration(roundId, stats.consensus);
  useBringIntoView(ref);

  if (stats.totalVotes === 0) {
    return (
      <Panel className="animate-rise p-6 text-center text-sm text-muted">
        Nobody voted this round. Start a re-vote when the team is ready.
      </Panel>
    );
  }

  const maxCount = Math.max(...stats.distribution.map((d) => d.count));
  const outliers = participants.filter((p) => stats.outlierIds.includes(p.id));

  return (
    <div ref={ref} className="scroll-mt-24">
      <Panel className="animate-rise overflow-hidden" aria-labelledby="results-title">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3.5">
          <h2 id="results-title" className="text-sm font-semibold">
            Results
          </h2>
          {stats.consensus ? (
            <span className="inline-flex animate-pop items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
              <PartyPopper className="size-3.5" /> Full consensus on {stats.mode[0]}
            </span>
          ) : stats.countedVotes > 0 ? (
            <span className="text-xs text-muted">
              {stats.countedVotes} of {stats.totalVotes} votes counted
            </span>
          ) : null}
        </div>

        <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          {/* Stat tiles */}
          <dl className="grid grid-cols-2 gap-3 self-start">
            <Stat
              label={DECKS[deck].numeric ? 'Average' : 'Most common'}
              value={
                DECKS[deck].numeric ? formatAverage(stats.average) : stats.mode.join(' / ') || '—'
              }
            />
            <Stat label="Median" value={stats.median ?? '—'} />
            <div className="col-span-2 rounded-xl bg-surface-2 px-4 py-3">
              <dt className="flex items-center justify-between text-xs text-muted">
                Agreement
                <span className="font-mono text-sm font-semibold text-fg tabular-nums">
                  {formatPercent(stats.agreement)}
                </span>
              </dt>
              <dd className="mt-2">
                <div
                  className="h-2 overflow-hidden rounded-full bg-surface-3"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(stats.agreement * 100)}
                  aria-label="Agreement"
                >
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-700',
                      stats.agreement >= 0.75
                        ? 'bg-success'
                        : stats.agreement >= 0.5
                          ? 'bg-primary'
                          : 'bg-warning',
                    )}
                    style={{ width: `${stats.agreement * 100}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  {stats.agreement >= 0.75
                    ? 'Strong alignment.'
                    : stats.agreement >= 0.5
                      ? 'Mostly aligned — a quick check-in may help.'
                      : 'Wide spread — worth discussing before re-voting.'}
                </p>
              </dd>
            </div>
          </dl>

          {/* Distribution — single series horizontal bars */}
          <div>
            <h3 className="mb-3 text-xs font-medium text-muted">Vote distribution</h3>
            <ul className="space-y-2">
              {stats.distribution.map((d) => {
                const isTop = stats.mode.includes(d.value);
                const names = d.participantIds.map(nameOf).join(', ');
                return (
                  <li
                    key={d.value}
                    className="group flex items-center gap-3"
                    title={`${d.value}: ${names}`}
                  >
                    <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface font-mono text-xs font-semibold">
                      {d.value}
                    </span>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <div
                        className={cn(
                          'h-5 min-w-1.5 rounded-r-[4px] transition-[width] duration-700 ease-out',
                          isTop ? 'bg-primary' : 'bg-primary/35',
                        )}
                        style={{ width: `${(d.count / maxCount) * 70}%` }}
                      />
                      <span className="shrink-0 text-xs font-semibold tabular-nums">{d.count}</span>
                      <span className="min-w-0 truncate text-xs text-subtle opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
                        {names}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            {outliers.length > 0 && (
              <p className="mt-4 flex gap-2 rounded-xl bg-warning-soft px-3 py-2.5 text-xs leading-relaxed text-warning">
                <TriangleAlert className="mt-px size-3.5 shrink-0" />
                <span>
                  <strong className="font-semibold">Hear them out:</strong>{' '}
                  {outliers.map((p) => `${p.name} (${p.vote})`).join(', ')}{' '}
                  {outliers.length === 1 ? 'is' : 'are'} far from the median — they may know
                  something the team doesn&apos;t.
                </span>
              </p>
            )}
          </div>
        </div>

        <FinalizeBar stats={stats} />
      </Panel>
    </div>
  );
}

/**
 * After the flip animation, scroll so the whole results panel (incl. the finalize bar)
 * sits between the sticky header and the docked deck — without hiding its top.
 */
function useBringIntoView(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const t = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dock = document.querySelector<HTMLElement>('[data-dock]')?.offsetHeight ?? 0;
      const header = 80;
      const overflowBottom = rect.bottom - (window.innerHeight - dock - 16);
      const delta = Math.min(overflowBottom, rect.top - header);
      if (delta <= 0) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollBy({ top: delta, behavior: reduce ? 'auto' : 'smooth' });
    }, 900);
    return () => clearTimeout(t);
  }, [ref]);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
    </div>
  );
}

function FinalizeBar({ stats }: { stats: RoundStats }) {
  const isFacilitator = useRoomStore(selectIsFacilitator);
  const story = useRoomStore(selectCurrentStory);
  const deck = useRoomStore((s) => s.state!.room.deck);
  const hasNext = useRoomStore((s) =>
    s.state!.stories.some((st) => st.id !== story?.id && st.status !== 'ESTIMATED'),
  );
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'next' | null>(null);

  if (!isFacilitator || !story) return null;
  const selected = choice ?? story.finalEstimate ?? stats.suggested;

  const save = async (advance: boolean) => {
    if (!selected) return;
    setBusy(advance ? 'next' : 'save');
    await roomActions.finalize(selected, advance);
    setBusy(null);
  };

  return (
    <div className="border-t border-border bg-surface-2/50 px-5 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">Final estimate</p>
          <div
            className="mt-2 flex flex-wrap gap-1.5"
            role="radiogroup"
            aria-label="Final estimate"
          >
            {valueCards(deck).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={selected === c}
                onClick={() => setChoice(c)}
                className={cn(
                  'relative h-9 min-w-9 rounded-lg border px-2 font-mono text-sm font-semibold transition',
                  selected === c
                    ? 'border-primary bg-primary text-primary-fg shadow-sm'
                    : 'border-border bg-surface text-fg hover:border-border-strong',
                )}
              >
                {c}
                {c === stats.suggested && selected !== c && (
                  <span
                    className="absolute -top-1 -right-1 size-2 rounded-full bg-primary"
                    aria-label="suggested"
                  />
                )}
              </button>
            ))}
          </div>
          {stats.suggested && (
            <p className="mt-1.5 text-xs text-muted">
              Suggested: <span className="font-semibold text-fg">{stats.suggested}</span>
              {stats.consensus
                ? ' (consensus)'
                : stats.agreement >= 0.5
                  ? ' (majority)'
                  : ' (average, rounded up)'}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            onClick={() => save(false)}
            loading={busy === 'save'}
            disabled={!selected}
          >
            <Save className="size-4" /> Save
          </Button>
          <Button
            variant="success"
            onClick={() => save(true)}
            loading={busy === 'next'}
            disabled={!selected}
          >
            {hasNext ? (
              <>
                Save &amp; next story <ArrowRight className="size-4" />
              </>
            ) : (
              'Save & finish'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Confetti on full consensus — once per round, never with reduced motion. */
function useCelebration(roundId: string, consensus: boolean) {
  const fired = useRef<string | null>(null);
  useEffect(() => {
    if (!consensus || fired.current === roundId) return;
    fired.current = roundId;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let cancelled = false;
    void import('canvas-confetti').then(({ default: confetti }) => {
      if (cancelled) return;
      const colors = ['#7c6cff', '#a855f7', '#34d399', '#f5b342'];
      // Wait for the card flip to land before celebrating.
      setTimeout(() => {
        void confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.55 },
          colors,
          disableForReducedMotion: true,
        });
      }, 650);
    });
    return () => {
      cancelled = true;
    };
  }, [roundId, consensus]);
}
