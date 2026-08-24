// Seven-card hand evaluator (ADR-0004).
//
// The contract, in one line: `evaluateHand` returns a SINGLE comparable integer,
// HIGHER IS STRONGER, and two equal values mean the hands are equally strong and
// the pot splits. It deliberately does not return "category plus a kicker array" —
// that shape forces every call site to write its own comparison, and split-pot
// bugs breed in exactly those hand-rolled comparisons.

import { RANK_COUNT, SUIT_COUNT, type Card, rankOf, suitOf } from './cards.ts';

export const HandCategory = {
  HighCard: 0,
  Pair: 1,
  TwoPair: 2,
  Trips: 3,
  Straight: 4,
  Flush: 5,
  FullHouse: 6,
  Quads: 7,
  StraightFlush: 8,
} as const;

export type HandCategory = (typeof HandCategory)[keyof typeof HandCategory];

/**
 * How many tiebreaker ranks each category actually carries. Without this a
 * consumer cannot tell an unused slot from a genuine deuce, since a deuce is
 * rank 0.
 */
export const TIEBREAKER_COUNT: Record<HandCategory, number> = {
  [HandCategory.HighCard]: 5,
  [HandCategory.Pair]: 4,
  [HandCategory.TwoPair]: 3,
  [HandCategory.Trips]: 3,
  [HandCategory.Straight]: 1,
  [HandCategory.Flush]: 5,
  [HandCategory.FullHouse]: 2,
  [HandCategory.Quads]: 2,
  [HandCategory.StraightFlush]: 1,
};

/** Opaque strength score. Only ever compare these with `<`, `>` and `===`. */
export type HandValue = number;

const CATEGORY_SHIFT = 20;

const pack = (category: number, a = 0, b = 0, c = 0, d = 0, e = 0): HandValue =>
  (category << CATEGORY_SHIFT) | (a << 16) | (b << 12) | (c << 8) | (d << 4) | e;

export const categoryOf = (value: HandValue): HandCategory =>
  (value >>> CATEGORY_SHIFT) as HandCategory;

/** The key ranks behind a value, strongest first — enough to write hand prose. */
export function tiebreakersOf(value: HandValue): number[] {
  const count = TIEBREAKER_COUNT[categoryOf(value)];
  const ranks: number[] = [];
  for (let i = 0; i < count; i++) ranks.push((value >>> (16 - i * 4)) & 0xf);
  return ranks;
}

// Scratch buffers, hoisted so the equity Monte Carlo can call this millions of
// times without allocating (ADR-0005). Safe because evaluation is synchronous,
// single-threaded and never re-entrant.
const rankCount = new Int32Array(RANK_COUNT);
const suitCount = new Int32Array(SUIT_COUNT);
const suitMask = new Int32Array(SUIT_COUNT);
const quads = new Int32Array(RANK_COUNT);
const trips = new Int32Array(RANK_COUNT);
const pairs = new Int32Array(RANK_COUNT);
const singles = new Int32Array(RANK_COUNT);

const WHEEL_MASK = (1 << 12) | (1 << 3) | (1 << 2) | (1 << 1) | 1;

/**
 * Top rank of a five-card straight inside a 13-bit rank mask, or -1.
 * Returns 3 (a five) for the wheel.
 */
function straightHigh(mask: number): number {
  for (let high = 12; high >= 4; high--) {
    const need =
      (1 << high) | (1 << (high - 1)) | (1 << (high - 2)) | (1 << (high - 3)) | (1 << (high - 4));
    if ((mask & need) === need) return high;
  }
  // The wheel needs its own case: the ace plays low here, and only here. The
  // loop above stops at a five-high straight for the same reason an ace must
  // not wrap the other way — Q-K-A-2-3 is not a straight.
  if ((mask & WHEEL_MASK) === WHEEL_MASK) return 3;
  return -1;
}

/**
 * Score five, six or seven cards. Higher is stronger; equal means split.
 * Accepts `ArrayLike` so the equity loop can hand it a reused array.
 */
export function evaluateHand(cards: ArrayLike<Card>): HandValue {
  rankCount.fill(0);
  suitCount.fill(0);
  suitMask.fill(0);
  let rankMask = 0;

  const n = cards.length;
  for (let i = 0; i < n; i++) {
    const card = cards[i] as Card;
    const rank = card >> 2;
    const suit = card & 3;
    rankCount[rank]!++;
    suitCount[suit]!++;
    suitMask[suit]! |= 1 << rank;
    rankMask |= 1 << rank;
  }

  let flushSuit = -1;
  for (let suit = 0; suit < SUIT_COUNT; suit++) if (suitCount[suit]! >= 5) flushSuit = suit;

  if (flushSuit >= 0) {
    const mask = suitMask[flushSuit]!;
    // A straight flush has to be found WITHIN the flush suit. Checking
    // `hasFlush && hasStraight` is the classic way to promote a plain flush by
    // mistake, e.g. Ah Kh Qh Jh 9h Ts Tc.
    const straight = straightHigh(mask);
    if (straight >= 0) return pack(HandCategory.StraightFlush, straight);

    // Six- and seven-card flushes: take the top five.
    let found = 0;
    let a = 0;
    let b = 0;
    let c = 0;
    let d = 0;
    let e = 0;
    for (let rank = 12; rank >= 0 && found < 5; rank--) {
      if ((mask & (1 << rank)) === 0) continue;
      if (found === 0) a = rank;
      else if (found === 1) b = rank;
      else if (found === 2) c = rank;
      else if (found === 3) d = rank;
      else e = rank;
      found++;
    }
    return pack(HandCategory.Flush, a, b, c, d, e);
  }

  let nQuads = 0;
  let nTrips = 0;
  let nPairs = 0;
  let nSingles = 0;
  for (let rank = 12; rank >= 0; rank--) {
    const count = rankCount[rank]!;
    if (count === 4) quads[nQuads++] = rank;
    else if (count === 3) trips[nTrips++] = rank;
    else if (count === 2) pairs[nPairs++] = rank;
    else if (count === 1) singles[nSingles++] = rank;
  }

  if (nQuads > 0) {
    const quad = quads[0]!;
    // The kicker can come from a pair or from trips, not only from the singles.
    let kicker = 0;
    for (let rank = 12; rank >= 0; rank--) {
      if (rank !== quad && rankCount[rank]! > 0) {
        kicker = rank;
        break;
      }
    }
    return pack(HandCategory.Quads, quad, kicker);
  }

  // Two sets of trips is a full house: the higher set plays as the trips.
  if (nTrips >= 2) return pack(HandCategory.FullHouse, trips[0]!, trips[1]!);
  if (nTrips === 1 && nPairs >= 1) return pack(HandCategory.FullHouse, trips[0]!, pairs[0]!);

  const straight = straightHigh(rankMask);
  if (straight >= 0) return pack(HandCategory.Straight, straight);

  if (nTrips === 1) return pack(HandCategory.Trips, trips[0]!, singles[0]!, singles[1]!);

  if (nPairs >= 2) {
    const high = pairs[0]!;
    const low = pairs[1]!;
    // Seven cards can hold three pairs, and then the kicker may well be the
    // third pair's rank rather than any of the singles.
    let kicker = 0;
    for (let rank = 12; rank >= 0; rank--) {
      if (rank !== high && rank !== low && rankCount[rank]! > 0) {
        kicker = rank;
        break;
      }
    }
    return pack(HandCategory.TwoPair, high, low, kicker);
  }

  if (nPairs === 1) {
    return pack(HandCategory.Pair, pairs[0]!, singles[0]!, singles[1]!, singles[2]!);
  }

  return pack(
    HandCategory.HighCard,
    singles[0]!,
    singles[1]!,
    singles[2]!,
    singles[3]!,
    singles[4]!,
  );
}

/** The seven-card entry point named in the ticket; same function, same contract. */
export const evaluate7 = evaluateHand;

const byStrengthThenSuit = (a: Card, b: Card): number =>
  rankOf(b) - rankOf(a) || suitOf(a) - suitOf(b);

const subsetScratch: Card[] = [0, 0, 0, 0, 0];

/**
 * The five cards that make the hand, for highlighting a winner at Reveal.
 * Deterministic: the input is sorted by rank descending then suit ascending, and
 * the first maximal subset in that order wins, so materially identical choices
 * always come out the same way.
 */
export function bestFive(cards: readonly Card[]): Card[] {
  if (cards.length < 5) throw new Error(`bestFive needs at least 5 cards, got ${cards.length}`);
  const sorted = [...cards].sort(byStrengthThenSuit);
  const n = sorted.length;
  let bestValue = -1;
  let best: Card[] = [];

  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            subsetScratch[0] = sorted[a]!;
            subsetScratch[1] = sorted[b]!;
            subsetScratch[2] = sorted[c]!;
            subsetScratch[3] = sorted[d]!;
            subsetScratch[4] = sorted[e]!;
            const value = evaluateHand(subsetScratch);
            if (value > bestValue) {
              bestValue = value;
              best = [...subsetScratch];
            }
          }
        }
      }
    }
  }
  return best;
}
