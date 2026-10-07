import { BREAK_CARD, UNSURE_CARD } from '@pokerplan/shared';

/** The key sequence that selects a card, e.g. `13`, `xl`, `c` for ☕. */
export function cardShortcut(card: string): string {
  if (card === BREAK_CARD) return 'c';
  if (card === UNSURE_CARD) return '?';
  if (card === '½') return 'h';
  return card.toLowerCase();
}

export type ShortcutMatch =
  /** Select this card now. */
  | { kind: 'select'; card: string }
  /** Buffer is an exact match but also a prefix of a longer card (e.g. `1` vs `13`) — wait. */
  | { kind: 'pending'; card: string }
  /** Buffer is only a prefix — keep typing. */
  | { kind: 'prefix' }
  | { kind: 'none' };

/** Resolves typed characters against a deck. Pure, so it can be unit tested. */
export function matchShortcut(buffer: string, cards: readonly string[]): ShortcutMatch {
  const typed = buffer.toLowerCase();
  if (!typed) return { kind: 'none' };
  const keys = cards.map((card) => ({ card, key: cardShortcut(card) }));
  const exact = keys.find((k) => k.key === typed);
  const longer = keys.some((k) => k.key !== typed && k.key.startsWith(typed));
  if (exact)
    return longer ? { kind: 'pending', card: exact.card } : { kind: 'select', card: exact.card };
  return longer ? { kind: 'prefix' } : { kind: 'none' };
}

/**
 * Feeds one key into the buffer. If the extended buffer matches nothing we restart from
 * the new key alone, so typing `8` after a stray `x` still selects 8.
 */
export function feedShortcut(
  buffer: string,
  key: string,
  cards: readonly string[],
): { buffer: string; match: ShortcutMatch } {
  const extended = buffer + key;
  const match = matchShortcut(extended, cards);
  if (match.kind !== 'none') return { buffer: extended, match };
  const fresh = matchShortcut(key, cards);
  return { buffer: fresh.kind === 'none' ? '' : key, match: fresh };
}
