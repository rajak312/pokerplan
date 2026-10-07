import { DECKS } from '@pokerplan/shared';
import { describe, expect, it } from 'vitest';
import { cardShortcut, feedShortcut, matchShortcut } from './shortcuts';

const fib = DECKS.FIBONACCI.cards;
const tshirt = DECKS.TSHIRT.cards;

describe('cardShortcut', () => {
  it('maps special cards to typeable keys', () => {
    expect(cardShortcut('☕')).toBe('c');
    expect(cardShortcut('?')).toBe('?');
    expect(cardShortcut('½')).toBe('h');
    expect(cardShortcut('XL')).toBe('xl');
  });
});

describe('matchShortcut', () => {
  it('selects unambiguous cards immediately', () => {
    expect(matchShortcut('0', fib)).toEqual({ kind: 'select', card: '0' });
    expect(matchShortcut('13', fib)).toEqual({ kind: 'select', card: '13' });
    expect(matchShortcut('?', fib)).toEqual({ kind: 'select', card: '?' });
  });

  it('waits when the typed value is a prefix of a longer card', () => {
    expect(matchShortcut('1', fib)).toEqual({ kind: 'pending', card: '1' }); // 1 vs 13
    expect(matchShortcut('5', fib)).toEqual({ kind: 'pending', card: '5' }); // 5 vs 55
    expect(matchShortcut('2', DECKS.TSHIRT.cards)).toEqual({ kind: 'none' });
  });

  it('reports pure prefixes and misses', () => {
    expect(matchShortcut('x', tshirt)).toEqual({ kind: 'prefix' }); // xs / xl / xxl
    expect(matchShortcut('4', fib)).toEqual({ kind: 'none' });
    expect(matchShortcut('', fib)).toEqual({ kind: 'none' });
  });

  it('is case-insensitive for T-shirt sizes', () => {
    expect(matchShortcut('XS', tshirt)).toEqual({ kind: 'select', card: 'XS' });
    expect(matchShortcut('m', tshirt)).toEqual({ kind: 'select', card: 'M' });
  });
});

describe('feedShortcut', () => {
  it('builds multi-key values', () => {
    const first = feedShortcut('', '2', fib);
    expect(first.match).toEqual({ kind: 'pending', card: '2' });
    const second = feedShortcut(first.buffer, '1', fib);
    expect(second.match).toEqual({ kind: 'select', card: '21' });
  });

  it('restarts from the latest key when the sequence stops matching', () => {
    const result = feedShortcut('8', '0', fib); // "80" isn't a card, "0" is
    expect(result).toEqual({ buffer: '0', match: { kind: 'select', card: '0' } });
  });

  it('clears the buffer on unknown keys', () => {
    expect(feedShortcut('', 'z', fib)).toEqual({ buffer: '', match: { kind: 'none' } });
  });
});
