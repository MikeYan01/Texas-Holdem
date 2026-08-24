import { describe, expect, it } from 'vitest';
import { DECK_SIZE, rankOf, suitOf } from './cards.ts';
import {
  HandCategory,
  TIEBREAKER_COUNT,
  bestFive,
  categoryOf,
  evaluateHand,
  tiebreakersOf,
} from './evaluate-hand.ts';
import { seededRng } from './rng.ts';

// The exhaustive run proves the *category* of all 133,784,560 hands, and the
// differential run proves the *ordering* against `phe`. Neither says anything
// about `bestFive` or `tiebreakersOf`, which is what the render layer reads to
// highlight the winning cards and to write "两对,A 带 K". These are the gap.

const SAMPLES = 60_000;

function randomHands(seed: number, count: number): Int32Array[] {
  const rng = seededRng(seed);
  const deck = Int32Array.from({ length: DECK_SIZE }, (_, i) => i);
  const hands: Int32Array[] = [];
  for (let i = 0; i < count; i++) {
    for (let k = 0; k < 7; k++) {
      const j = k + ((rng() * (DECK_SIZE - k)) | 0);
      const swap = deck[k]!;
      deck[k] = deck[j]!;
      deck[j] = swap;
    }
    hands.push(deck.slice(0, 7));
  }
  return hands;
}

describe('bestFive, over a large sample of real hands', () => {
  it('always picks five of the seven cards that score exactly what the seven did', () => {
    // Assertions are collected rather than run per hand: `expect` in a tight
    // loop dominates the runtime, and one reported failure is more useful than
    // the first of sixty thousand.
    let failure: string | null = null;
    for (const hand of randomHands(31_337, SAMPLES)) {
      const seven = Array.from(hand);
      const five = bestFive(seven);
      const unique = new Set(five);

      if (five.length !== 5 || unique.size !== 5) failure ??= `not five cards: ${seven.join(' ')}`;
      for (const card of five) {
        if (!seven.includes(card)) failure ??= `card ${card} not in ${seven.join(' ')}`;
      }
      if (evaluateHand(five) !== evaluateHand(seven)) {
        failure ??= `best five scores differently: ${seven.join(' ')} -> ${five.join(' ')}`;
      }
      if (failure) break;
    }
    expect(failure).toBeNull();
  });

  it('is unaffected by the order the seven cards arrive in', () => {
    const rng = seededRng(4242);
    for (const hand of randomHands(555, 4000)) {
      const forward = Array.from(hand);
      const shuffled = [...forward];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = (rng() * (i + 1)) | 0;
        [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
      }
      expect(new Set(bestFive(shuffled))).toEqual(new Set(bestFive(forward)));
    }
  });

  it('returns cards consistent with the category it claims', () => {
    for (const hand of randomHands(909, 20_000)) {
      const seven = Array.from(hand);
      const five = bestFive(seven);
      const category = categoryOf(evaluateHand(seven));
      const suits = new Set(five.map(suitOf));

      // A flush or straight flush has to be five cards of one suit; anything
      // else must not be, or a real flush was missed.
      const oneSuit = suits.size === 1;
      const isFlushy =
        category === HandCategory.Flush || category === HandCategory.StraightFlush;
      expect(oneSuit, `${seven.join(' ')} -> ${category}`).toBe(isFlushy);

      if (category === HandCategory.Quads) {
        const ranks = five.map(rankOf);
        const counts = new Map<number, number>();
        for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
        expect([...counts.values()].sort()).toEqual([1, 4]);
      }
    }
  });
});

describe('tiebreakersOf, over a large sample of real hands', () => {
  it('reports exactly the number of ranks its category uses, all of them real ranks', () => {
    let failure: string | null = null;
    for (const hand of randomHands(777, SAMPLES)) {
      const value = evaluateHand(hand);
      const ranks = tiebreakersOf(value);
      if (ranks.length !== TIEBREAKER_COUNT[categoryOf(value)]) {
        failure ??= `wrong tiebreaker count for ${hand.join(' ')}`;
      }
      for (const rank of ranks) {
        if (rank < 0 || rank > 12) failure ??= `rank ${rank} out of range for ${hand.join(' ')}`;
      }
      if (failure) break;
    }
    expect(failure).toBeNull();
  });

  it('orders hands the same way the raw values do', () => {
    // Two hands of the same category must compare identically whether you use
    // the packed integer or read the tiebreakers back out — otherwise the prose
    // on screen could disagree with who actually won.
    const hands = randomHands(2026, 20_000);
    const byCategory = new Map<HandCategory, number[]>();
    for (const hand of hands) {
      const value = evaluateHand(hand);
      const bucket = byCategory.get(categoryOf(value)) ?? [];
      bucket.push(value);
      byCategory.set(categoryOf(value), bucket);
    }

    for (const [, values] of byCategory) {
      for (let i = 1; i < Math.min(values.length, 2000); i++) {
        const left = values[i - 1]!;
        const right = values[i]!;
        const lexicographic = compare(tiebreakersOf(left), tiebreakersOf(right));
        expect(Math.sign(left - right)).toBe(lexicographic);
      }
    }
  });

  it('gives equal hands equal tiebreakers', () => {
    const hands = randomHands(31, 20_000);
    const seen = new Map<number, number[]>();
    for (const hand of hands) {
      const value = evaluateHand(hand);
      const ranks = tiebreakersOf(value);
      const previous = seen.get(value);
      if (previous) expect(ranks).toEqual(previous);
      else seen.set(value, ranks);
    }
    expect(seen.size).toBeGreaterThan(1000);
  });
});

function compare(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i]! !== b[i]!) return Math.sign(a[i]! - b[i]!);
  }
  return 0;
}
