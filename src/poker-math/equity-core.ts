// The two sampling engines behind Equity, kept apart from the Street dispatch so
// the offline table generator can use them before the table it generates exists.

import { DECK_SIZE, type Card } from './cards.ts';
import { evaluateHand } from './evaluate-hand.ts';
import type { Rng } from './rng.ts';

export const DEFAULT_ITERATIONS = 2000;

export type EquityMethod = 'preflop-table' | 'monte-carlo' | 'exact-enumeration';

export type EquityResult = {
  /** Share of the pot won on average: `(wins + ties / 2) / samples`. */
  readonly equity: number;
  readonly win: number;
  readonly tie: number;
  readonly method: EquityMethod;
  readonly samples: number;
};

/**
 * Every hand a single opponent could hold on the river.
 *
 * Note on the count: the spec and ADR-0005 both quote C(44,2) = 946. That is off
 * by one card. Seven cards are known — two in hand and five on the board — which
 * leaves 45 unknown, so the exact number of opponent holdings is C(45,2) = 990.
 * Enumerating all 990 is what "exact" actually means here, and that is what this
 * does; 946 would have skipped 44 of them.
 *
 * Enumerating beats sampling at this size on both speed and accuracy, so there
 * is no reason to add noise.
 *
 * Deliberately not extended to several opponents. The joint space is 990^n, so
 * "exact" would stop being true long before it stopped being affordable.
 * Multi-way rivers fall through to Monte Carlo and say so in `method`, rather
 * than claiming a precision they do not have.
 */
export function enumerateRiverHeadsUp(
  hole: readonly [Card, Card],
  board: readonly Card[],
): EquityResult {
  const dead = new Uint8Array(DECK_SIZE);
  for (const card of hole) dead[card] = 1;
  for (const card of board) dead[card] = 1;

  const live: number[] = [];
  for (let card = 0; card < DECK_SIZE; card++) if (!dead[card]) live.push(card);

  const heroCards = new Int32Array(7);
  const villainCards = new Int32Array(7);
  heroCards[0] = hole[0];
  heroCards[1] = hole[1];
  for (let i = 0; i < 5; i++) {
    heroCards[2 + i] = board[i]!;
    villainCards[2 + i] = board[i]!;
  }
  const hero = evaluateHand(heroCards);

  let win = 0;
  let tie = 0;
  let samples = 0;
  for (let i = 0; i < live.length; i++) {
    villainCards[0] = live[i]!;
    for (let j = i + 1; j < live.length; j++) {
      villainCards[1] = live[j]!;
      const villain = evaluateHand(villainCards);
      if (hero > villain) win++;
      else if (hero === villain) tie++;
      samples++;
    }
  }

  return {
    equity: (win + tie / 2) / samples,
    win: win / samples,
    tie: tie / samples,
    method: 'exact-enumeration',
    samples,
  };
}

/**
 * Monte Carlo, written to allocate nothing per iteration: a flat `Int32Array`
 * deck built once per call, seven-slot hands reused, and a partial Fisher-Yates
 * that draws only the cards actually needed. Written the idiomatic way —
 * `[...deck].sort()` inside the loop — this runs an order of magnitude slower,
 * and that discipline is most of the measured 0.72 µs per iteration.
 */
export function monteCarloEquity(options: {
  readonly hole: readonly [Card, Card];
  readonly board: readonly Card[];
  readonly opponentCount: number;
  readonly rng: Rng;
  readonly iterations?: number;
}): EquityResult {
  const { hole, board, opponentCount, rng } = options;
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;

  const dead = new Uint8Array(DECK_SIZE);
  for (const card of hole) dead[card] = 1;
  for (const card of board) dead[card] = 1;

  const deck = new Int32Array(DECK_SIZE - hole.length - board.length);
  let size = 0;
  for (let card = 0; card < DECK_SIZE; card++) if (!dead[card]) deck[size++] = card;

  const needed = opponentCount * 2 + (5 - board.length);
  if (needed > size) throw new Error('not enough cards left to deal');

  const heroCards = new Int32Array(7);
  const villainCards = new Int32Array(7);
  heroCards[0] = hole[0];
  heroCards[1] = hole[1];

  const community = new Int32Array(5);
  for (let i = 0; i < board.length; i++) community[i] = board[i]!;

  let win = 0;
  let tie = 0;

  for (let iteration = 0; iteration < iterations; iteration++) {
    // Only the first `needed` slots have to end up random.
    for (let i = 0; i < needed; i++) {
      const j = i + ((rng() * (size - i)) | 0);
      const swap = deck[i]!;
      deck[i] = deck[j]!;
      deck[j] = swap;
    }

    let drawn = opponentCount * 2;
    for (let i = board.length; i < 5; i++) community[i] = deck[drawn++]!;
    for (let i = 0; i < 5; i++) {
      heroCards[2 + i] = community[i]!;
      villainCards[2 + i] = community[i]!;
    }

    const hero = evaluateHand(heroCards);
    let best = hero;
    let tied = 0;
    for (let opponent = 0; opponent < opponentCount; opponent++) {
      villainCards[0] = deck[opponent * 2]!;
      villainCards[1] = deck[opponent * 2 + 1]!;
      const villain = evaluateHand(villainCards);
      if (villain > best) {
        best = villain;
        tied = 0;
      } else if (villain === best) {
        tied++;
      }
    }

    if (best === hero) {
      if (tied === 0) win++;
      else tie++;
    }
  }

  return {
    equity: (win + tie / 2) / iterations,
    win: win / iterations,
    tie: tie / iterations,
    method: 'monte-carlo',
    samples: iterations,
  };
}
