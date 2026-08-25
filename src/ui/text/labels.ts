// Names for things: Streets, pots, suits, and chip counts.
//
// Every function here takes a `Locale` rather than reading one from a context,
// so it stays callable from a plain Node test (ADR-0008).
//
// `all-in` stays in English in both languages (AGENTS.md): the Chinese rendering
// is not what anyone at a table actually says.
//
// Chip counts are always shown as chips, never as big blinds. BB is the right
// unit for measuring Bot strength — it does not distort when the stakes move —
// but on screen it is a second name for a quantity already on display, and
// "40 BB" beside a Seat holding 200 reads as a contradiction rather than as
// extra information.
//
// The Bots' personalities deliberately have no display name here. They are
// labelled with player names instead (see `bot-names.ts`), and pinning a play
// style on a Seat would both hand the reader a free tell and, now that the names
// are real people's, say something untrue about them.

import type { Street } from '../../engine/types.ts';
import { LOCALE_TAGS, type Locale } from './locale.ts';

export const STREET_NAMES: Record<Locale, Record<Street, string>> = {
  zh: {
    preflop: '翻牌前',
    flop: '翻牌',
    turn: '转牌',
    river: '河牌',
  },
  en: {
    preflop: 'Preflop',
    flop: 'Flop',
    turn: 'Turn',
    river: 'River',
  },
};

export const streetName = (street: Street, locale: Locale): string =>
  STREET_NAMES[locale][street];

export const potName = (potIndex: number, locale: Locale): string =>
  potIndex === 0
    ? locale === 'zh'
      ? '主池'
      : 'Main pot'
    : locale === 'zh'
      ? `边池 ${potIndex}`
      : `Side pot ${potIndex}`;

/**
 * Why a Hand can have two winners. Without this the table looks broken: the best
 * hand on show takes the smaller pot and somebody weaker takes the bigger one.
 */
export const POT_NOTE: Record<Locale, { readonly main: string; readonly side: string }> = {
  zh: {
    main: '主池:每个还在牌局里的人都有资格争夺。',
    side:
      '边池:有人 all-in 但筹码盖不住别人的下注时,多出来的部分单独成池,' +
      'all-in 的人无权争夺——你最多只能从每个对手身上赢走自己投入的那么多。' +
      '所以牌力最大的人如果码量不够,只能赢走主池。',
  },
  en: {
    main: 'Main pot: every Seat still in the Hand is entitled to contest it.',
    side:
      'Side pot: when a Seat is all-in but its Stack cannot cover what others have bet, ' +
      'the excess forms a pot of its own, and the all-in Seat has no claim on it — you can ' +
      'only ever win as much from each opponent as you put in yourself. So the strongest ' +
      'hand at the table, if it is short, wins the main pot and nothing above it.',
  },
};

export const potNote = (potIndex: number, locale: Locale): string =>
  potIndex === 0 ? POT_NOTE[locale].main : POT_NOTE[locale].side;

export const suitSymbol = ['♠', '♥', '♦', '♣'] as const;
export const suitIsRed = (suit: number): boolean => suit === 1 || suit === 2;

/**
 * A chip count, grouped the way the reader's language groups numbers.
 *
 * One definition for both the felt and the results screen. They used to format
 * separately, and had already drifted: the same Score read "+1,240" beside the
 * Seat and "+1240" in the ranking.
 */
export const formatChips = (amount: number, locale: Locale): string =>
  amount.toLocaleString(LOCALE_TAGS[locale]);

/** A Score, which is signed: the plus carries as much meaning as the digits. */
export const formatScore = (score: number, locale: Locale): string =>
  `${score > 0 ? '+' : ''}${formatChips(score, locale)}`;
