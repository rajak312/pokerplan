'use client';

import { BREAK_CARD, DECKS, UNSURE_CARD } from '@pokerplan/shared';
import { Coffee, Eye } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
import { roomActions } from '@/lib/room-actions';
import { selectIsFacilitator, selectMe, selectMyVote, useRoomStore } from '@/lib/room-store';
import { cardShortcut, feedShortcut } from '@/lib/shortcuts';

/** How long to wait for a second digit when the typed key is a prefix of a longer card. */
const AMBIGUITY_MS = 450;

export function CardDeck() {
  const deck = useRoomStore((s) => s.state!.room.deck);
  const revealed = useRoomStore((s) => s.state!.round?.revealed ?? false);
  const hasRound = useRoomStore((s) => Boolean(s.state!.round));
  const me = useRoomStore(selectMe);
  const myVote = useRoomStore(selectMyVote);
  const cards = DECKS[deck].cards;
  const spectator = me?.isSpectator ?? false;
  const disabled = revealed || spectator || !hasRound;

  useCardShortcuts(cards, disabled);

  const pick = (card: string) => {
    if (disabled) return;
    void roomActions.vote(myVote === card ? null : card);
  };

  return (
    <div
      data-dock
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/85 backdrop-blur-xl"
    >
      <div className="mx-auto max-w-[1440px] px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
        <p
          className={cn('text-center text-xs text-muted', !(revealed && !spectator) && 'mb-2')}
          aria-live="polite"
        >
          {spectator ? (
            <span className="inline-flex items-center gap-1.5">
              <Eye className="size-3.5" /> You&apos;re spectating — switch to voter in the
              participants list to play.
            </span>
          ) : revealed ? (
            <>
              Cards are revealed
              {myVote ? (
                <>
                  {' '}
                  — you played <strong className="font-semibold text-fg">{myVote}</strong>
                </>
              ) : null}
              . The deck is back when the next round starts.
            </>
          ) : myVote ? (
            <>
              You picked <strong className="font-semibold text-fg">{myVote}</strong>. Change your
              mind any time before the reveal.
            </>
          ) : (
            'Pick a card — or just type its value.'
          )}
        </p>
        {revealed && !spectator ? null : (
          <div
            role="radiogroup"
            aria-label="Your estimate"
            className="-mx-3 flex snap-x gap-2 overflow-x-auto px-3 pt-3 pb-1 sm:mx-0 sm:justify-center sm:overflow-visible sm:px-0"
          >
            {cards.map((card) => {
              const selected = myVote === card;
              return (
                <button
                  key={card}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={
                    card === BREAK_CARD
                      ? 'Coffee break'
                      : card === UNSURE_CARD
                        ? 'Not sure'
                        : `Vote ${card}`
                  }
                  disabled={disabled}
                  onClick={() => pick(card)}
                  className={cn(
                    'group relative flex h-[76px] w-[52px] shrink-0 snap-center flex-col items-center justify-center rounded-xl border-2 font-bold transition-all duration-200 sm:h-[88px] sm:w-[60px]',
                    selected
                      ? '-translate-y-3 border-primary bg-primary text-primary-fg shadow-lift'
                      : 'border-border bg-surface text-fg shadow-card hover:-translate-y-1.5 hover:border-primary/60 hover:text-primary',
                    disabled &&
                      !selected &&
                      'opacity-45 hover:translate-y-0 hover:border-border hover:text-fg',
                    disabled && 'cursor-not-allowed',
                  )}
                >
                  <span className={cn(card.length > 2 ? 'text-base' : 'text-xl sm:text-2xl')}>
                    {card === BREAK_CARD ? (
                      <Coffee className="size-5 sm:size-6" aria-hidden />
                    ) : (
                      card
                    )}
                  </span>
                  {cardShortcut(card) !== card.toLowerCase() && (
                    <span
                      className={cn(
                        'absolute bottom-1 hidden font-mono text-[9px] font-medium uppercase sm:block',
                        selected ? 'text-primary-fg/70' : 'text-subtle',
                      )}
                      aria-hidden
                    >
                      {cardShortcut(card)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], dialog[open]'));
}

/** Global keyboard voting: type `5`, `13`, `xl`, `?`, `c`; Esc withdraws; R/N for the facilitator. */
function useCardShortcuts(cards: readonly string[], disabled: boolean) {
  const buffer = useRef('');
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearPending = () => {
      if (pending.current) clearTimeout(pending.current);
      pending.current = null;
    };
    const vote = (card: string) => {
      buffer.current = '';
      clearPending();
      void roomActions.vote(card);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector('dialog[open]')) return;
      const s = useRoomStore.getState();
      const facilitator = selectIsFacilitator(s);
      const round = s.state?.round;
      const key = e.key.toLowerCase();

      if (facilitator && key === 'r' && round && !round.revealed) {
        e.preventDefault();
        void roomActions.reveal();
        return;
      }
      if (facilitator && key === 'n' && round?.revealed) {
        e.preventDefault();
        void roomActions.next();
        return;
      }
      if (disabled) return;
      if (e.key === 'Escape') {
        if (selectMyVote(s)) void roomActions.vote(null);
        return;
      }
      if (key.length !== 1) return;

      const { buffer: next, match } = feedShortcut(buffer.current, key, cards);
      buffer.current = next;
      clearPending();
      if (match.kind === 'none') return;
      e.preventDefault();
      if (match.kind === 'select') vote(match.card);
      else if (match.kind === 'pending') {
        const card = match.card;
        pending.current = setTimeout(() => vote(card), AMBIGUITY_MS);
      } else {
        pending.current = setTimeout(() => (buffer.current = ''), AMBIGUITY_MS * 2);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearPending();
    };
  }, [cards, disabled]);
}
