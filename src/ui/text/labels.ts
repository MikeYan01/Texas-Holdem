// Names for things, in Chinese.
//
// A few terms stay in English on purpose (AGENTS.md): `BB` and `all-in`, because
// the Chinese renderings are not what anyone at a table actually says.
//
// The Bots' personalities deliberately have no display name here. They are
// labelled with player names instead (see `bot-names.ts`), and pinning a play
// style on a Seat would both hand the reader a free tell and, now that the names
// are real people's, say something untrue about them.

import type { Street } from '../../engine/types.ts';

export const STREET_NAMES: Record<Street, string> = {
  preflop: '翻牌前',
  flop: '翻牌',
  turn: '转牌',
  river: '河牌',
};

export const potName = (potIndex: number): string =>
  potIndex === 0 ? '主池' : `边池 ${potIndex}`;

/**
 * Why a Hand can have two winners. Without this the table looks broken: the best
 * hand on show takes the smaller pot and somebody weaker takes the bigger one.
 */
export const POT_NOTE = {
  main: '主池:每个还在牌局里的人都有资格争夺。',
  side:
    '边池:有人 all-in 但筹码盖不住别人的下注时,多出来的部分单独成池,' +
    'all-in 的人无权争夺——你最多只能从每个对手身上赢走自己投入的那么多。' +
    '所以牌力最大的人如果码量不够,只能赢走主池。',
} as const;

export const potNote = (potIndex: number): string =>
  potIndex === 0 ? POT_NOTE.main : POT_NOTE.side;

export const suitSymbol = ['♠', '♥', '♦', '♣'] as const;
export const suitIsRed = (suit: number): boolean => suit === 1 || suit === 2;
