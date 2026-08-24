// Names for things, in Chinese.
//
// A few terms stay in English on purpose (AGENTS.md): `BB` and `all-in` because
// the Chinese renderings are not what anyone at a table says, and three of the
// Bot personality names for the same reason.

import type { Street } from '../../engine/types.ts';
import type { PersonalityKey } from '../../bots/types.ts';

export const STREET_NAMES: Record<Street, string> = {
  preflop: '翻牌前',
  flop: '翻牌',
  turn: '转牌',
  river: '河牌',
};

/** TAG, LAG and Maniac keep their English names; the other two do not need to. */
export const PERSONALITY_NAMES: Record<PersonalityKey, string> = {
  TAG: 'TAG',
  LAG: 'LAG',
  CallingStation: '跟注站',
  Rock: '岩石',
  Maniac: 'Maniac',
};

export const PERSONALITY_BLURBS: Record<PersonalityKey, string> = {
  TAG: '紧且激进',
  LAG: '松且激进',
  CallingStation: '松且被动',
  Rock: '紧且被动',
  Maniac: '近乎无视牌力',
};

export const potName = (potIndex: number): string =>
  potIndex === 0 ? '主池' : `边池 ${potIndex}`;

export const suitSymbol = ['♠', '♥', '♦', '♣'] as const;
export const suitIsRed = (suit: number): boolean => suit === 1 || suit === 2;
