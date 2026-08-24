// Chinese hand descriptions.
//
// This is the render layer, and it is the only place these strings exist. The
// engine hands over a `HandValue` — one integer — and everything below is read
// back out of it (AGENTS.md: no user-facing text inside the engine).

import {
  HandCategory,
  categoryOf,
  tiebreakersOf,
  type HandValue,
} from '../../poker-math/evaluate-hand.ts';

/**
 * Rank names as a Chinese table would say them. Note "10" rather than the "T"
 * the engine uses internally: nobody says "T 到 A".
 */
export const RANK_NAMES = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
] as const;

export const CATEGORY_NAMES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: '高牌',
  [HandCategory.Pair]: '一对',
  [HandCategory.TwoPair]: '两对',
  [HandCategory.Trips]: '三条',
  [HandCategory.Straight]: '顺子',
  [HandCategory.Flush]: '同花',
  [HandCategory.FullHouse]: '葫芦',
  [HandCategory.Quads]: '四条',
  [HandCategory.StraightFlush]: '同花顺',
};

const rank = (index: number): string => RANK_NAMES[index] ?? '?';

/** The two ends of a straight whose top card is `high`, wheel included. */
function straightEnds(high: number): { low: string; high: string } {
  // A five-high straight is the wheel, where the ace plays from below.
  if (high === 3) return { low: 'A', high: '5' };
  return { low: rank(high - 4), high: rank(high) };
}

/**
 * A hand in Chinese, for the Reveal panel: "两对,A 带 K,踢脚 Q".
 *
 * Every category names its key cards and, where they decide anything, its
 * kickers — a two-pair hand that wins on the kicker should say so.
 */
export function describeHand(value: HandValue): string {
  const category = categoryOf(value);
  const ranks = tiebreakersOf(value);
  const name = CATEGORY_NAMES[category];

  switch (category) {
    case HandCategory.StraightFlush: {
      const ends = straightEnds(ranks[0]!);
      if (ends.high === 'A') return '皇家同花顺';
      return `${name},${ends.low} 到 ${ends.high}`;
    }
    case HandCategory.Quads:
      return `${name} ${rank(ranks[0]!)},踢脚 ${rank(ranks[1]!)}`;
    case HandCategory.FullHouse:
      return `${name},${rank(ranks[0]!)} 带 ${rank(ranks[1]!)}`;
    case HandCategory.Flush:
      return `${name},${rank(ranks[0]!)} 高`;
    case HandCategory.Straight: {
      const ends = straightEnds(ranks[0]!);
      return `${name},${ends.low} 到 ${ends.high}`;
    }
    case HandCategory.Trips:
      return `${name} ${rank(ranks[0]!)},踢脚 ${ranks.slice(1).map(rank).join(' ')}`;
    case HandCategory.TwoPair:
      return `${name},${rank(ranks[0]!)} 带 ${rank(ranks[1]!)},踢脚 ${rank(ranks[2]!)}`;
    case HandCategory.Pair:
      return `${name} ${rank(ranks[0]!)},踢脚 ${ranks.slice(1).map(rank).join(' ')}`;
    case HandCategory.HighCard:
      return `${name},${rank(ranks[0]!)} 高`;
  }
}

/** Just the category, for a compact badge. */
export const describeCategory = (value: HandValue): string => CATEGORY_NAMES[categoryOf(value)];
