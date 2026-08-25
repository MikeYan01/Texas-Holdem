// Hand names, in both languages.
//
// This is the render layer, and it is the only place these strings exist. The
// engine hands over a `HandValue` — one integer — and everything below is read
// back out of it (AGENTS.md: no user-facing text inside the engine).
//
// The locale arrives as an argument rather than from a React context, which is
// what lets a Node test assert every hand in every language (ADR-0008).

import {
  HandCategory,
  categoryOf,
  tiebreakersOf,
  type HandValue,
} from '../../poker-math/evaluate-hand.ts';
import type { Locale } from './locale.ts';

/**
 * Rank names as a table would say them, and the same in both languages. Note
 * "10" rather than the "T" the engine uses internally: nobody says "T 到 A", and
 * nobody says "T to ace" either.
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

/**
 * English names a hand by the plural of its key rank — "two pair, aces and
 * kings" — where Chinese repeats the symbol. Spelling them out rather than
 * writing "A and K" is what makes the English read like a table rather than like
 * a translation.
 */
const PLURAL_RANK_NAMES = [
  'twos',
  'threes',
  'fours',
  'fives',
  'sixes',
  'sevens',
  'eights',
  'nines',
  'tens',
  'jacks',
  'queens',
  'kings',
  'aces',
] as const;

export const CATEGORY_NAMES: Record<Locale, Record<HandCategory, string>> = {
  zh: {
    [HandCategory.HighCard]: '高牌',
    [HandCategory.Pair]: '一对',
    [HandCategory.TwoPair]: '两对',
    [HandCategory.Trips]: '三条',
    [HandCategory.Straight]: '顺子',
    [HandCategory.Flush]: '同花',
    [HandCategory.FullHouse]: '葫芦',
    [HandCategory.Quads]: '四条',
    [HandCategory.StraightFlush]: '同花顺',
  },
  en: {
    [HandCategory.HighCard]: 'High card',
    [HandCategory.Pair]: 'Pair',
    [HandCategory.TwoPair]: 'Two pair',
    [HandCategory.Trips]: 'Three of a kind',
    [HandCategory.Straight]: 'Straight',
    [HandCategory.Flush]: 'Flush',
    [HandCategory.FullHouse]: 'Full house',
    [HandCategory.Quads]: 'Four of a kind',
    [HandCategory.StraightFlush]: 'Straight flush',
  },
};

export const categoryName = (category: HandCategory, locale: Locale): string =>
  CATEGORY_NAMES[locale][category];

const rank = (index: number): string => RANK_NAMES[index] ?? '?';
const plural = (index: number): string => PLURAL_RANK_NAMES[index] ?? '?';

/** The two ends of a straight whose top card is `high`, wheel included. */
function straightEnds(high: number): { low: string; high: string } {
  // A five-high straight is the wheel, where the ace plays from below.
  if (high === 3) return { low: 'A', high: '5' };
  return { low: rank(high - 4), high: rank(high) };
}

/**
 * A hand in words: "两对,A 和 K,踢脚 Q" or "Two pair, aces and kings, kicker Q".
 *
 * Every category names its key cards and, where they decide anything, its
 * kickers — a two-pair hand that wins on the kicker should say so.
 */
export function describeHand(value: HandValue, locale: Locale): string {
  const category = categoryOf(value);
  const ranks = tiebreakersOf(value);
  const name = CATEGORY_NAMES[locale][category];
  const kickers = (from: number) => ranks.slice(from).map(rank).join(' ');

  if (locale === 'en') {
    switch (category) {
      case HandCategory.StraightFlush: {
        const ends = straightEnds(ranks[0]!);
        if (ends.high === 'A') return 'Royal flush';
        return `${name}, ${ends.low} to ${ends.high}`;
      }
      case HandCategory.Quads:
        return `${name}, ${plural(ranks[0]!)}, kicker ${rank(ranks[1]!)}`;
      case HandCategory.FullHouse:
        return `${name}, ${plural(ranks[0]!)} full of ${plural(ranks[1]!)}`;
      case HandCategory.Flush:
        return `${name}, ${rank(ranks[0]!)} high`;
      case HandCategory.Straight: {
        const ends = straightEnds(ranks[0]!);
        return `${name}, ${ends.low} to ${ends.high}`;
      }
      case HandCategory.Trips:
        return `${name}, ${plural(ranks[0]!)}, kickers ${kickers(1)}`;
      case HandCategory.TwoPair:
        return `${name}, ${plural(ranks[0]!)} and ${plural(ranks[1]!)}, kicker ${rank(ranks[2]!)}`;
      case HandCategory.Pair:
        return `${name} of ${plural(ranks[0]!)}, kickers ${kickers(1)}`;
      case HandCategory.HighCard:
        return `${name}, ${rank(ranks[0]!)} high`;
    }
  }

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
      return `${name} ${rank(ranks[0]!)},踢脚 ${kickers(1)}`;
    case HandCategory.TwoPair:
      return `${name},${rank(ranks[0]!)} 和 ${rank(ranks[1]!)},踢脚 ${rank(ranks[2]!)}`;
    case HandCategory.Pair:
      return `${name} ${rank(ranks[0]!)},踢脚 ${kickers(1)}`;
    case HandCategory.HighCard:
      return `${name},${rank(ranks[0]!)} 高`;
  }
}

/**
 * What a kicker is, for anywhere a hand description is shown. It is the card
 * that decides the hand when two players hold the same thing, so it is worth
 * explaining rather than leaving as jargon.
 */
export const KICKER_NOTE: Record<Locale, string> = {
  zh: '踢脚:牌型相同时用来分高下的闲牌。两人同为一对 A 时,踢脚大的那个赢。',
  en:
    'Kicker: the spare card that separates two Seats holding the same thing. ' +
    'When both hold a pair of aces, the bigger kicker wins.',
};

export const kickerNote = (locale: Locale): string => KICKER_NOTE[locale];

/** Just the category, for a compact badge. */
export const describeCategory = (value: HandValue, locale: Locale): string =>
  CATEGORY_NAMES[locale][categoryOf(value)];
