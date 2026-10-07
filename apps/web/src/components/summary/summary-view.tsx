'use client';

import { DECKS, ROOM_ID_PATTERN, type SummaryStory } from '@pokerplan/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, Download, ExternalLink, ListTodo } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Panel } from '@/components/ui/misc';
import { FullPageMessage, MinimalHeader } from '@/components/room/states';
import { ApiError, api, queryKeys } from '@/lib/api';
import { cn } from '@/lib/cn';
import { csvFileName, downloadCsv, summaryToCsv } from '@/lib/csv';
import { formatAverage, formatDate, formatPercent } from '@/lib/format';

export function SummaryView({ roomId }: { roomId: string }) {
  const valid = ROOM_ID_PATTERN.test(roomId);
  const query = useQuery({
    queryKey: queryKeys.summary(roomId),
    queryFn: () => api.getSummary(roomId),
    enabled: valid,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });

  if (!valid || (query.error instanceof ApiError && query.error.status === 404)) {
    return <FullPageMessage kind="not-found" />;
  }

  const summary = query.data;
  return (
    <div className="min-h-dvh">
      <MinimalHeader />
      <main className="mx-auto max-w-5xl px-5 pt-4 pb-20">
        <Link
          href={`/r/${roomId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-fg"
        >
          <ArrowLeft className="size-4" /> Back to room
        </Link>

        {query.isPending ? (
          <div className="mt-6 space-y-4" aria-busy="true">
            <div className="h-10 w-72 animate-pulse rounded-lg bg-surface-2" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-2" />
              ))}
            </div>
            <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />
          </div>
        ) : query.isError ? (
          <Panel className="mt-6 p-8 text-center">
            <p className="font-medium">Couldn&apos;t load the session history</p>
            <p className="mt-1 text-sm text-muted">{query.error.message}</p>
            <Button className="mt-4" variant="secondary" onClick={() => void query.refetch()}>
              Try again
            </Button>
          </Panel>
        ) : summary ? (
          <>
            <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-primary">Session history</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight break-words">
                  {summary.room.name}
                </h1>
                <p className="mt-1 text-sm text-muted">
                  {DECKS[summary.room.deck].label} · Created {formatDate(summary.room.createdAt)} ·{' '}
                  {summary.participants.length} participant
                  {summary.participants.length === 1 ? '' : 's'}
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => downloadCsv(csvFileName(summary), summaryToCsv(summary))}
                disabled={summary.stories.length === 0}
              >
                <Download className="size-4" /> Export CSV
              </Button>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Stories" value={summary.totals.stories} />
              <Tile
                label="Estimated"
                value={`${summary.totals.estimated}/${summary.totals.stories}`}
              />
              <Tile label="Total points" value={summary.totals.points ?? '—'} />
              <Tile label="Voting rounds" value={summary.totals.rounds} />
            </dl>

            {summary.stories.length === 0 ? (
              <Panel className="mt-6 flex flex-col items-center px-6 py-14 text-center">
                <ListTodo className="size-6 text-muted" />
                <p className="mt-3 font-medium">No stories in this session yet</p>
                <p className="mt-1 text-sm text-muted">
                  Add stories in the room — finalized estimates show up here.
                </p>
              </Panel>
            ) : (
              <Panel className="mt-6 overflow-hidden">
                <ol className="divide-y divide-border">
                  {summary.stories.map((s, i) => (
                    <StoryRow key={s.id} story={s} index={i} />
                  ))}
                </ol>
              </Panel>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-card">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
    </div>
  );
}

function StoryRow({ story, index }: { story: SummaryStory; index: number }) {
  const [open, setOpen] = useState(false);
  const last = story.rounds.at(-1);
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        disabled={story.rounds.length === 0}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition enabled:hover:bg-surface-2/60 disabled:cursor-default"
      >
        <span className="w-6 shrink-0 font-mono text-xs text-subtle">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="font-medium break-words">{story.title}</p>
          <p className="mt-0.5 text-xs text-muted">
            {story.rounds.length === 0
              ? 'Not voted on yet'
              : `${story.rounds.length} round${story.rounds.length === 1 ? '' : 's'} · ${
                  last?.stats
                    ? `avg ${formatAverage(last.stats.average)} · ${formatPercent(last.stats.agreement)} agreement`
                    : ''
                }`}
          </p>
        </div>
        {story.finalEstimate ? (
          <span className="flex h-10 min-w-10 items-center justify-center rounded-lg bg-success-soft px-2 font-mono text-lg font-bold text-success">
            {story.finalEstimate}
          </span>
        ) : (
          <Badge>Not estimated</Badge>
        )}
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-subtle transition',
            open && 'rotate-180',
            story.rounds.length === 0 && 'invisible',
          )}
        />
      </button>
      {open && (
        <div className="animate-fade-in space-y-3 px-5 pb-5 pl-15">
          {story.link && (
            <a
              href={story.link}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" /> {story.link.replace(/^https?:\/\//, '')}
            </a>
          )}
          {story.rounds.map((r) => (
            <div key={r.id} className="rounded-xl bg-surface-2 p-3">
              <p className="text-xs font-semibold text-muted">
                Round {r.number}
                {r.stats?.consensus && <span className="ml-2 text-success">· Consensus</span>}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {r.votes.length === 0 ? (
                  <li className="text-xs text-muted">No votes</li>
                ) : (
                  r.votes.map((v, i) => (
                    <li
                      key={i}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface py-1 pr-2 pl-1 text-xs"
                    >
                      <span className="rounded-md bg-surface-3 px-1.5 py-0.5 font-mono font-semibold">
                        {v.value}
                      </span>
                      {v.participantName}
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
