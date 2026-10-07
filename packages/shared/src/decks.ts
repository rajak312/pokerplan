export const DECK_TYPES = ['FIBONACCI', 'MODIFIED_FIBONACCI', 'TSHIRT', 'POWERS_OF_TWO'] as const;
export type DeckType = (typeof DECK_TYPES)[number];

/** Card that means "I have no idea" — excluded from statistics. */
export const UNSURE_CARD = '?';
/** Card that means "I need a break" — excluded from statistics. */
export const BREAK_CARD = '☕';

export interface DeckDefinition {
  type: DeckType;
  label: string;
  description: string;
  /** Cards in display order. Value cards first, then special cards. */
  cards: readonly string[];
  /** Whether the value cards can be averaged (false for T-shirt sizes). */
  numeric: boolean;
}

export const DECKS: Record<DeckType, DeckDefinition> = {
  FIBONACCI: {
    type: 'FIBONACCI',
    label: 'Fibonacci',
    description: '0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89',
    cards: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', UNSURE_CARD, BREAK_CARD],
    numeric: true,
  },
  MODIFIED_FIBONACCI: {
    type: 'MODIFIED_FIBONACCI',
    label: 'Modified Fibonacci',
    description: '0, ½, 1, 2, 3, 5, 8, 13, 20, 40, 100',
    cards: ['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', UNSURE_CARD, BREAK_CARD],
    numeric: true,
  },
  TSHIRT: {
    type: 'TSHIRT',
    label: 'T-shirt sizes',
    description: 'XS, S, M, L, XL, XXL',
    cards: ['XS', 'S', 'M', 'L', 'XL', 'XXL', UNSURE_CARD, BREAK_CARD],
    numeric: false,
  },
  POWERS_OF_TWO: {
    type: 'POWERS_OF_TWO',
    label: 'Powers of 2',
    description: '0, 1, 2, 4, 8, 16, 32, 64',
    cards: ['0', '1', '2', '4', '8', '16', '32', '64', UNSURE_CARD, BREAK_CARD],
    numeric: true,
  },
};

export function isSpecialCard(card: string): boolean {
  return card === UNSURE_CARD || card === BREAK_CARD;
}

/** Cards that carry an estimate (i.e. everything except `?` and `☕`). */
export function valueCards(deck: DeckType): string[] {
  return DECKS[deck].cards.filter((c) => !isSpecialCard(c));
}

export function isValidCard(deck: DeckType, card: string): boolean {
  return DECKS[deck].cards.includes(card);
}

/** Numeric value of a card, or `null` for special / non-numeric cards. */
export function cardToNumber(card: string): number | null {
  if (card === '½') return 0.5;
  if (isSpecialCard(card)) return null;
  const n = Number(card);
  return Number.isFinite(n) && card.trim() !== '' ? n : null;
}
