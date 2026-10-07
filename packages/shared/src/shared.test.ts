import { describe, expect, it } from 'vitest';
import { DECKS, cardToNumber, isValidCard, valueCards } from './decks';
import { createRoomSchema, storyInputSchema } from './schemas';

describe('decks', () => {
  it('parses numeric cards, including ½', () => {
    expect(cardToNumber('13')).toBe(13);
    expect(cardToNumber('½')).toBe(0.5);
    expect(cardToNumber('?')).toBeNull();
    expect(cardToNumber('XL')).toBeNull();
  });

  it('excludes special cards from value cards', () => {
    expect(valueCards('TSHIRT')).toEqual(['XS', 'S', 'M', 'L', 'XL', 'XXL']);
    expect(DECKS.FIBONACCI.cards).toContain('?');
  });

  it('validates cards against the deck', () => {
    expect(isValidCard('POWERS_OF_TWO', '16')).toBe(true);
    expect(isValidCard('POWERS_OF_TWO', '13')).toBe(false);
  });
});

describe('schemas', () => {
  it('trims names and drops empty facilitator names', () => {
    const parsed = createRoomSchema.parse({
      name: '  Sprint 42  ',
      deck: 'FIBONACCI',
      facilitatorName: '   ',
      guestToken: 'a'.repeat(36),
    });
    expect(parsed.name).toBe('Sprint 42');
    expect(parsed.facilitatorName).toBeUndefined();
  });

  it('rejects non-http story links', () => {
    const result = storyInputSchema.safeParse({ title: 'Login', link: 'javascript:alert(1)' });
    expect(result.success).toBe(false);
  });
});
