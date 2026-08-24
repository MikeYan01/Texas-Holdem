// The numerical checks that are too slow to run on every save.
//
// Everything here is a convergence argument: the fast tests assert that the
// answers are shaped right, and these assert that they are *true* — that the
// sampler, given enough iterations, lands on the same numbers as the enumerator
// and as the table, and that the numbers the ticket names come out of this
// repository's own evaluator rather than out of a book.
//
// Every run is seeded, so a failure here reproduces exactly rather than being
// waved away as bad luck. Tolerances are stated as multiples of the 1σ sampling
// error for the iteration count in use: σ = sqrt(p(1-p)/n), at worst 0.5/sqrt(n).

import { describe, expect, it } from 'vitest';
import { parseCards, type Card } from './cards.ts';
import { computeEquity } from './equity.ts';
import { monteCarloEquity } from './equity-core.ts';
import { lookupPreflop } from './preflop-equity.ts';
import { representativeCards } from './starting-hands.ts';
import { seededRng } from './rng.ts';

const hole = (text: string): [Card, Card] => {
  const cards = parseCards(text);
  return [cards[0]!, cards[1]!];
};

/** Worst-case 1σ error of a proportion estimated from `n` samples, in percent. */
const sigmaPercent = (n: number): number => (0.5 / Math.sqrt(n)) * 100;

const sample = (
  holeCards: readonly [Card, Card],
  board: readonly Card[],
  opponentCount: number,
  iterations: number,
  seed: number,
) =>
  monteCarloEquity({
    hole: holeCards,
    board,
    opponentCount,
    rng: seededRng(seed),
    iterations,
  }).equity;

describe('the numbers the ticket names', () => {
  // 500k iterations puts 1σ at 0.07%, so half a point of tolerance is seven
  // sigma: wide enough never to flake, narrow enough that a real regression —
  // a broken shuffle, a miscounted tie, an evaluator that ranks wrongly — could
  // not slip through it.
  const ITERATIONS = 500_000;
  const TOLERANCE = 0.5;

  const named: readonly { readonly label: string; readonly hand: string; readonly opponents: number; readonly expected: number }[] = [
    { label: 'AA', hand: 'Ah Ad', opponents: 1, expected: 85.2 },
    { label: 'KK', hand: 'Kh Kd', opponents: 1, expected: 82.4 },
    { label: 'AKs', hand: 'Ah Kh', opponents: 1, expected: 67.0 },
    { label: 'AA', hand: 'Ah Ad', opponents: 5, expected: 49.2 },
  ];

  it('is what a fresh sampling run finds, independently of the table', () => {
    expect(sigmaPercent(ITERATIONS)).toBeLessThan(0.08);
    for (const { hand, opponents, expected } of named) {
      const measured = sample(hole(hand), [], opponents, ITERATIONS, 20_260_824) * 100;
      expect(measured, `${hand} vs ${opponents}`).toBeGreaterThan(expected - TOLERANCE);
      expect(measured, `${hand} vs ${opponents}`).toBeLessThan(expected + TOLERANCE);
    }
  });

  it('is what the shipped table says, which is the number a caller gets', () => {
    for (const { label, hand, opponents, expected } of named) {
      const fromTable = lookupPreflop(label, opponents)!.equity * 100;
      const fromLookup = computeEquity({
        hole: hole(hand),
        board: [],
        opponentCount: opponents,
        rng: seededRng(1),
      });
      expect(fromLookup.method).toBe('preflop-table');
      expect(fromLookup.equity * 100, `${label} vs ${opponents}`).toBe(fromTable);
      expect(fromTable, `${label} vs ${opponents}`).toBeGreaterThan(expected - TOLERANCE);
      expect(fromTable, `${label} vs ${opponents}`).toBeLessThan(expected + TOLERANCE);
    }
  });
});

describe('the shipped table and a fresh sampling run', () => {
  it('agree across the whole range of starting hands', () => {
    // A spread from the best hand to the worst, checked against a run seeded
    // differently from the one that built the table. 200k puts 1σ at 0.11% on
    // each side, so half a point of tolerance is about three sigma of the
    // difference. A table that had drifted, or been hand-edited, would not
    // survive this.
    const iterations = 200_000;
    const spread = ['AA', 'QQ', '99', '22', 'AKs', 'AKo', 'JTs', 'T9o', 'A5s', 'K2o', '72o', '32s'];
    for (const label of spread) {
      for (const opponents of [1, 4]) {
        const measured = sample(
          representativeCards(label),
          [],
          opponents,
          iterations,
          7_777 + opponents,
        );
        expect(measured, `${label} vs ${opponents}`).toBeCloseTo(
          lookupPreflop(label, opponents)!.equity,
          2,
        );
      }
    }
  });
});

describe('exact enumeration and sampling on the river', () => {
  it('agree on every board they are given', () => {
    // The enumeration is the ground truth here: it counts all 990 opponent
    // holdings. If the sampler disagrees with it by more than the noise, one of
    // the two is wrong, and the fast tests would not tell us which.
    const spots: readonly (readonly [string, string])[] = [
      ['Ah Kd', '2h 7s 9c Jd 3s'],
      ['Th 9h', 'Jh 8h 2c Qd 3s'],
      ['7c 7d', 'Ah Kh Qh 7s 2d'],
      ['As Ks', 'Qs Js Ts 2c 3d'],
      ['4c 5d', '6h 7s 8c Ad Kd'],
      ['2c 3d', 'Ah Ad As Kh Kd'],
    ];
    for (const [holeText, boardText] of spots) {
      const heroHole = hole(holeText);
      const board = parseCards(boardText);
      const exact = computeEquity({ hole: heroHole, board, opponentCount: 1, rng: seededRng(1) });
      expect(exact.method).toBe('exact-enumeration');
      expect(exact.samples).toBe(990);
      const sampled = sample(heroHole, board, 1, 200_000, 4_242);
      expect(sampled, `${holeText} on ${boardText}`).toBeCloseTo(exact.equity, 2);
    }
  });
});

describe('the accuracy the default 2000 iterations actually buys', () => {
  it('lands within the error ADR-0005 advertises, across two hundred seeds', () => {
    // ADR-0005 claims about ±1.2% (1σ) at 2000 iterations and spends the rest of
    // its argument on that being good enough. This measures the claim instead of
    // trusting it: 200 independent 2000-iteration runs against a 400k reference
    // on the same spot.
    const heroHole = hole('Th 7d');
    const board = parseCards('Ah 9s 4c');
    const reference = sample(heroHole, board, 5, 400_000, 20_260_824);

    let worst = 0;
    let sumSquared = 0;
    const runs = 200;
    for (let seed = 0; seed < runs; seed++) {
      const error = Math.abs(sample(heroHole, board, 5, 2_000, seed) - reference);
      worst = Math.max(worst, error);
      sumSquared += error * error;
    }
    const rms = Math.sqrt(sumSquared / runs);

    // The theoretical 1σ here is at most 1.12%; the measured spread must not be
    // materially worse, and no single run may be more than five sigma out.
    expect(rms).toBeLessThan(0.015);
    expect(worst).toBeLessThan(0.06);
  });
});
