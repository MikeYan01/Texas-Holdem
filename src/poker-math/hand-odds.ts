// Hand Odds: "what am I most likely to end up with?"
//
// A different question from Equity, and a cheaper one. Equity asks whether you
// will win, so it has to deal the opponents in. This asks only what your own five
// best cards will be at showdown, which depends on nothing but your two cards and
// the board still to come.
//
// That makes it exactly computable everywhere, with no sampling anywhere:
//
//   * Preflop — a lookup. C(50,5) = 2,118,760 boards per starting hand is too
//     much for a keypress but nothing for an offline script, so all 169 canonical
//     hands are enumerated exhaustively ahead of time.
//   * Flop — C(47,2) = 1,081 run-outs. Enumerated on the spot.
//   * Turn — 46 river cards. Enumerated on the spot.
//   * River — the hand is already made; the answer is a certainty.
//
// So unlike Equity, none of these numbers carry sampling error.

import { DECK_SIZE, type Card } from './cards.ts';
import { HandCategory, categoryOf, evaluateHand } from './evaluate-hand.ts';
import { PREFLOP_HAND_ODDS } from './preflop-hand-odds.ts';
import { canonicalHandLabel } from './starting-hands.ts';

const HAND_CATEGORY_COUNT = 9;

export type HandOddsMethod = 'preflop-table' | 'exact-enumeration';

export type HandOdds = {
  /** Probability of each final hand category, indexed by `HandCategory`. */
  readonly probabilities: readonly number[];
  readonly method: HandOddsMethod;
  /** How many run-outs stand behind the answer. Exact in every case. */
  readonly runOuts: number;
  /** Community cards still to come. Zero means the hand is already made. */
  readonly cardsToCome: number;
};

export type CategoryChance = {
  readonly category: HandCategory;
  readonly probability: number;
};

/**
 * The chance of finishing with each hand category, given what is known now.
 *
 * Synchronous on purpose. Equity hides behind an `await` because it may one day
 * move to a Web Worker (ADR-0005); this never will — the worst case is 1,081
 * evaluations, well under a millisecond — so pretending it is asynchronous would
 * only add ceremony.
 */
export function handOdds(hole: readonly [Card, Card], board: readonly Card[]): HandOdds {
  const cardsToCome = 5 - board.length;
  if (cardsToCome < 0 || cardsToCome > 5) throw new Error(`bad board length: ${board.length}`);
  if (cardsToCome === 5) return fromTable(hole);

  const dead = new Uint8Array(DECK_SIZE);
  for (const card of hole) dead[card] = 1;
  for (const card of board) dead[card] = 1;

  const live: number[] = [];
  for (let card = 0; card < DECK_SIZE; card++) if (!dead[card]) live.push(card);

  const counts = new Float64Array(HAND_CATEGORY_COUNT);
  const hand = new Int32Array(7);
  hand[0] = hole[0];
  hand[1] = hole[1];
  for (let i = 0; i < board.length; i++) hand[2 + i] = board[i]!;

  let runOuts = 0;

  if (cardsToCome === 0) {
    counts[categoryOf(evaluateHand(hand))]!++;
    runOuts = 1;
  } else if (cardsToCome === 1) {
    for (const card of live) {
      hand[6] = card;
      counts[categoryOf(evaluateHand(hand))]!++;
      runOuts++;
    }
  } else {
    // Two to come: every pair of the 47 unseen cards.
    for (let i = 0; i < live.length; i++) {
      hand[5] = live[i]!;
      for (let j = i + 1; j < live.length; j++) {
        hand[6] = live[j]!;
        counts[categoryOf(evaluateHand(hand))]!++;
        runOuts++;
      }
    }
  }

  return {
    probabilities: Array.from(counts, (count) => count / runOuts),
    method: 'exact-enumeration',
    runOuts,
    cardsToCome,
  };
}

function fromTable(hole: readonly [Card, Card]): HandOdds {
  const label = canonicalHandLabel(hole[0], hole[1]);
  const counts = PREFLOP_HAND_ODDS.table[label];
  if (!counts) throw new Error(`no preflop hand-odds entry for ${label}`);
  const total = PREFLOP_HAND_ODDS.boardsPerHand;
  return {
    probabilities: counts.map((count) => count / total),
    method: 'preflop-table',
    runOuts: total,
    cardsToCome: 5,
  };
}

/**
 * The likeliest categories, strongest-first among equals, dropping any that
 * cannot happen at all. A river hand yields exactly one; a preflop hand usually
 * fills the list.
 */
export function likeliestCategories(odds: HandOdds, limit: number): CategoryChance[] {
  return odds.probabilities
    .map((probability, category) => ({ category: category as HandCategory, probability }))
    .filter((entry) => entry.probability > 0)
    .sort((a, b) => b.probability - a.probability || b.category - a.category)
    .slice(0, limit);
}

/** What the Seat holds right now, or null before there is a hand to hold. */
export function madeCategoryNow(
  hole: readonly [Card, Card],
  board: readonly Card[],
): HandCategory | null {
  if (board.length < 3) return null;
  return categoryOf(evaluateHand([...hole, ...board]));
}
