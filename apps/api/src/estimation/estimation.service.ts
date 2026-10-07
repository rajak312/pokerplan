import { Injectable } from '@nestjs/common';
import {
  DECKS,
  cardToNumber,
  isSpecialCard,
  valueCards,
  type DeckType,
  type DistributionEntry,
  type RoundStats,
} from '@pokerplan/shared';

export interface VoteInput {
  participantId: string;
  value: string;
}

/** Minimum distance (in deck positions) from the median for a vote to count as an outlier. */
const OUTLIER_DISTANCE = 2;

/**
 * Pure statistics over a round of votes. Works with ordinal decks (T-shirt sizes) by
 * reasoning about card positions, and adds a numeric average for numeric decks.
 */
@Injectable()
export class EstimationService {
  compute(deck: DeckType, votes: readonly VoteInput[]): RoundStats {
    const definition = DECKS[deck];
    const order = valueCards(deck);
    const indexOf = (card: string) => order.indexOf(card);

    const counted = votes.filter((v) => !isSpecialCard(v.value) && indexOf(v.value) !== -1);
    const indices = counted.map((v) => indexOf(v.value)).sort((a, b) => a - b);

    // Distribution in deck order (special cards included so `?` is visible).
    const distribution: DistributionEntry[] = definition.cards
      .map((card) => {
        const voters = votes.filter((v) => v.value === card);
        return {
          value: card,
          count: voters.length,
          ratio: votes.length ? voters.length / votes.length : 0,
          participantIds: voters.map((v) => v.participantId),
        };
      })
      .filter((d) => d.count > 0);

    if (counted.length === 0) {
      return {
        totalVotes: votes.length,
        countedVotes: 0,
        average: null,
        median: null,
        min: null,
        max: null,
        mode: [],
        agreement: 0,
        consensus: false,
        suggested: null,
        distribution,
        outlierIds: [],
      };
    }

    // Mode & agreement.
    const counts = new Map<string, number>();
    for (const v of counted) counts.set(v.value, (counts.get(v.value) ?? 0) + 1);
    const topCount = Math.max(...counts.values());
    const mode = order.filter((card) => counts.get(card) === topCount);
    const agreement = topCount / counted.length;
    const consensus = counted.length >= 2 && counts.size === 1 && counted.length === votes.length;

    // Average (numeric decks only).
    const numbers = definition.numeric
      ? counted.map((v) => cardToNumber(v.value)).filter((n): n is number => n !== null)
      : [];
    const average = numbers.length
      ? round(numbers.reduce((a, b) => a + b, 0) / numbers.length)
      : null;

    // Median — numeric value for numeric decks, the middle card for ordinal decks.
    const medianIndex = medianOf(indices);
    let median: string;
    if (definition.numeric) {
      median = formatNumber(medianOf([...numbers].sort((a, b) => a - b)));
    } else {
      median = order[indices[Math.floor((indices.length - 1) / 2)]!]!;
    }

    // Outliers only make sense with a few voters.
    const outlierIds =
      counted.length >= 3
        ? counted
            .filter((v) => Math.abs(indexOf(v.value) - medianIndex) >= OUTLIER_DISTANCE)
            .map((v) => v.participantId)
        : [];

    return {
      totalVotes: votes.length,
      countedVotes: counted.length,
      average,
      median,
      min: order[indices[0]!]!,
      max: order[indices[indices.length - 1]!]!,
      mode,
      agreement: round(agreement, 4),
      consensus,
      suggested: this.suggest(deck, mode, agreement, average, order, indices),
      distribution,
      outlierIds,
    };
  }

  /**
   * Suggested final estimate: a clear majority wins; otherwise round the average *up*
   * to the next card (estimates should err on the side of caution).
   */
  private suggest(
    deck: DeckType,
    mode: string[],
    agreement: number,
    average: number | null,
    order: string[],
    sortedIndices: number[],
  ): string {
    if (mode.length === 1 && agreement >= 0.5) return mode[0]!;
    if (DECKS[deck].numeric && average !== null) {
      const card = order.find((c) => (cardToNumber(c) ?? -Infinity) >= average - 1e-9);
      return card ?? order[order.length - 1]!;
    }
    // Ordinal deck without majority: upper median card.
    return order[sortedIndices[Math.floor(sortedIndices.length / 2)]!]!;
  }
}

function medianOf(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(round(n, 2));
}
