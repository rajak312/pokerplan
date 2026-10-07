import type { RoomSummary } from '@pokerplan/shared';
import { describe, expect, it } from 'vitest';
import { csvCell, csvFileName, summaryToCsv, toCsv } from './csv';

describe('csvCell', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a, b')).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(5)).toBe('5');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell(-1)).toBe('-1'); // numbers are left alone
  });
});

describe('summaryToCsv', () => {
  const summary: RoomSummary = {
    room: {
      id: 'abcdefghij',
      name: 'Sprint 12 / Planning',
      deck: 'FIBONACCI',
      createdAt: '2026-03-04T10:00:00.000Z',
    },
    participants: [],
    stories: [
      {
        id: 's1',
        title: 'Login, with SSO',
        description: null,
        link: 'https://example.com/1',
        position: 0,
        status: 'ESTIMATED',
        finalEstimate: '5',
        estimatedAt: '2026-03-04T10:10:00.000Z',
        rounds: [
          {
            id: 'r1',
            number: 1,
            revealedAt: '2026-03-04T10:05:00.000Z',
            votes: [
              { participantName: 'Ana', value: '5' },
              { participantName: 'Bo', value: '8' },
            ],
            stats: {
              totalVotes: 2,
              countedVotes: 2,
              average: 6.5,
              median: '6.5',
              min: '5',
              max: '8',
              mode: ['5', '8'],
              agreement: 0.5,
              consensus: false,
              suggested: '8',
              distribution: [],
              outlierIds: [],
            },
          },
        ],
      },
      {
        id: 's2',
        title: 'Search',
        description: null,
        link: null,
        position: 1,
        status: 'PENDING',
        finalEstimate: null,
        estimatedAt: null,
        rounds: [],
      },
    ],
    totals: { stories: 2, estimated: 1, points: 5, rounds: 1 },
  };

  it('writes a header and one row per story', () => {
    const lines = summaryToCsv(summary).split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^#,Story,Link,Status,Final estimate/);
    expect(lines[1]).toBe(
      '1,"Login, with SSO",https://example.com/1,Estimated,5,1,6.5,6.5,50,Ana: 5; Bo: 8,2026-03-04T10:10:00.000Z',
    );
    expect(lines[2]).toBe('2,Search,,Not estimated,,0,,,,,');
  });

  it('builds a safe file name', () => {
    expect(csvFileName(summary)).toBe('pokerplan-sprint-12-planning-2026-03-04.csv');
  });

  it('joins rows with CRLF', () => {
    expect(
      toCsv([
        ['a', 'b'],
        [1, 2],
      ]),
    ).toBe('a,b\r\n1,2');
  });
});
