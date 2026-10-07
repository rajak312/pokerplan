import { EstimationService, type VoteInput } from './estimation.service';

const votes = (...values: string[]): VoteInput[] =>
  values.map((value, i) => ({ participantId: `p${i + 1}`, value }));

describe('EstimationService', () => {
  const service = new EstimationService();

  it('returns empty stats when nobody voted', () => {
    const stats = service.compute('FIBONACCI', []);
    expect(stats).toMatchObject({
      totalVotes: 0,
      countedVotes: 0,
      average: null,
      median: null,
      consensus: false,
      suggested: null,
      distribution: [],
    });
  });

  it('computes average, median, min, max and distribution in deck order', () => {
    const stats = service.compute('FIBONACCI', votes('8', '3', '5', '5'));
    expect(stats.average).toBe(5.25);
    expect(stats.median).toBe('5');
    expect(stats.min).toBe('3');
    expect(stats.max).toBe('8');
    expect(stats.distribution.map((d) => [d.value, d.count])).toEqual([
      ['3', 1],
      ['5', 2],
      ['8', 1],
    ]);
    expect(stats.distribution[1]!.participantIds).toEqual(['p3', 'p4']);
  });

  it('reports agreement as the share of the most common value', () => {
    const stats = service.compute('FIBONACCI', votes('5', '5', '5', '8'));
    expect(stats.mode).toEqual(['5']);
    expect(stats.agreement).toBe(0.75);
    expect(stats.consensus).toBe(false);
    expect(stats.suggested).toBe('5');
  });

  it('detects full consensus only with 2+ matching voters and no abstentions', () => {
    expect(service.compute('FIBONACCI', votes('3', '3', '3')).consensus).toBe(true);
    expect(service.compute('FIBONACCI', votes('3')).consensus).toBe(false);
    expect(service.compute('FIBONACCI', votes('3', '3', '?')).consensus).toBe(false);
  });

  it('excludes ? and ☕ from numeric stats but keeps them in the distribution', () => {
    const stats = service.compute('FIBONACCI', votes('2', '?', '☕', '3'));
    expect(stats.totalVotes).toBe(4);
    expect(stats.countedVotes).toBe(2);
    expect(stats.average).toBe(2.5);
    expect(stats.median).toBe('2.5');
    expect(stats.distribution.map((d) => d.value)).toEqual(['2', '3', '?', '☕']);
    expect(stats.distribution[0]!.ratio).toBe(0.25);
  });

  it('handles only-abstain rounds', () => {
    const stats = service.compute('FIBONACCI', votes('?', '?'));
    expect(stats.countedVotes).toBe(0);
    expect(stats.suggested).toBeNull();
    expect(stats.distribution).toEqual([
      { value: '?', count: 2, ratio: 1, participantIds: ['p1', 'p2'] },
    ]);
  });

  it('suggests the next card up from the average when there is no majority', () => {
    // avg = (3 + 5 + 8 + 13) / 4 = 7.25 → next Fibonacci card is 8
    expect(service.compute('FIBONACCI', votes('3', '5', '8', '13')).suggested).toBe('8');
  });

  it('flags votes two or more cards away from the median as outliers', () => {
    const stats = service.compute('FIBONACCI', votes('5', '5', '8', '5', '21', '1'));
    // deck positions: 1→1, 5→4, 8→5, 21→7; median position = 4
    expect(stats.outlierIds.sort()).toEqual(['p5', 'p6']);
  });

  it('does not flag outliers with fewer than three voters', () => {
    expect(service.compute('FIBONACCI', votes('1', '89')).outlierIds).toEqual([]);
  });

  it('supports the ½ card in modified Fibonacci', () => {
    const stats = service.compute('MODIFIED_FIBONACCI', votes('½', '1', '½'));
    expect(stats.average).toBe(0.67);
    expect(stats.median).toBe('0.5');
    expect(stats.suggested).toBe('½');
  });

  it('treats T-shirt sizes as ordinal (no average)', () => {
    const stats = service.compute('TSHIRT', votes('S', 'M', 'XL', 'M'));
    expect(stats.average).toBeNull();
    expect(stats.median).toBe('M');
    expect(stats.mode).toEqual(['M']);
    expect(stats.suggested).toBe('M');
    expect(stats.min).toBe('S');
    expect(stats.max).toBe('XL');
  });

  it('picks the upper median card for T-shirt sizes without a majority', () => {
    expect(service.compute('TSHIRT', votes('S', 'L')).suggested).toBe('L');
  });

  it('ignores values that do not belong to the deck', () => {
    const stats = service.compute('POWERS_OF_TWO', votes('4', '13'));
    expect(stats.countedVotes).toBe(1);
    expect(stats.average).toBe(4);
  });
});
