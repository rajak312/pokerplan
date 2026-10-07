'use client';

import { ArrowRight, Eye, ExternalLink, ListPlus, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge, Kbd, Panel } from '@/components/ui/misc';
import { roomActions } from '@/lib/room-actions';
import { selectCurrentStory, selectIsFacilitator, useRoomStore } from '@/lib/room-store';
import { RoundTimer } from './round-timer';
import { StoryDialog } from './story-dialog';

export function CurrentStory() {
  const story = useRoomStore(selectCurrentStory);
  const round = useRoomStore((s) => s.state!.round);
  const stories = useRoomStore((s) => s.state!.stories);
  const facilitator = useRoomStore((s) => s.state!.participants.find((p) => p.isFacilitator));
  const isFacilitator = useRoomStore(selectIsFacilitator);
  const votedCount = useRoomStore((s) => s.state!.participants.filter((p) => p.hasVoted).length);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const revealed = round?.revealed ?? false;
  const allDone = stories.length > 0 && stories.every((s) => s.status === 'ESTIMATED');
  const index = story ? stories.findIndex((s) => s.id === story.id) + 1 : 0;
  const hasNext = stories.some((s) => s.id !== story?.id && s.status !== 'ESTIMATED');

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    await fn();
    setBusy(null);
  };

  return (
    <Panel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted">
          {story ? (
            <>
              <Badge tone="primary">
                Story {index} of {stories.length}
              </Badge>
              {round && round.number > 1 && <Badge>Round {round.number}</Badge>}
              {story.finalEstimate && <Badge tone="success">Estimated {story.finalEstimate}</Badge>}
            </>
          ) : (
            <Badge>{allDone ? 'All stories estimated' : 'Quick vote'}</Badge>
          )}
        </div>
        <RoundTimer />
      </div>

      <div className="mt-3">
        {story ? (
          <>
            <h2 className="text-xl font-semibold tracking-tight text-pretty break-words sm:text-2xl">
              {story.title}
            </h2>
            {story.link && (
              <a
                href={story.link}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1.5 inline-flex max-w-full items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="size-3.5 shrink-0" />
                <span className="truncate">{story.link.replace(/^https?:\/\//, '')}</span>
              </a>
            )}
            {story.description && (
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed whitespace-pre-line text-muted">
                {story.description}
              </p>
            )}
          </>
        ) : allDone ? (
          <>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Every story has an estimate 🎉
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              Add more stories, keep voting freely, or open the history to export your results.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Free voting round</h2>
            <p className="mt-1.5 text-sm text-muted">
              {isFacilitator
                ? 'Vote right away, or add stories to build a queue and save estimates to each one.'
                : 'No story selected yet — vote on whatever the facilitator is discussing.'}
            </p>
          </>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {isFacilitator ? (
          <>
            {!revealed ? (
              <Button
                onClick={() => run('reveal', roomActions.reveal)}
                loading={busy === 'reveal'}
                disabled={votedCount === 0}
                title={votedCount === 0 ? 'Waiting for the first vote' : undefined}
              >
                <Eye className="size-4" /> Reveal cards{' '}
                <Kbd className="border-white/20 bg-white/15 text-white/90">R</Kbd>
              </Button>
            ) : hasNext ? (
              <Button onClick={() => run('next', roomActions.next)} loading={busy === 'next'}>
                Next story <ArrowRight className="size-4" />
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => run('reset', roomActions.reset)}
              loading={busy === 'reset'}
              disabled={!revealed && votedCount === 0}
            >
              <RotateCcw className="size-4" /> {revealed ? 'Re-vote' : 'Clear votes'}
            </Button>
            {!story && (
              <Button variant="ghost" onClick={() => setAdding(true)}>
                <ListPlus className="size-4" /> Add stories
              </Button>
            )}
            {!revealed && story && hasNext && (
              <Button
                variant="ghost"
                onClick={() => run('skip', roomActions.next)}
                loading={busy === 'skip'}
              >
                Skip
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">
            {revealed
              ? `Cards are on the table. ${facilitator ? `${facilitator.name} will` : 'The facilitator will'} pick the final estimate.`
              : `${facilitator ? facilitator.name : 'The facilitator'} reveals the cards when everyone has voted.`}
          </p>
        )}
      </div>
      <StoryDialog open={adding} onClose={() => setAdding(false)} />
    </Panel>
  );
}
