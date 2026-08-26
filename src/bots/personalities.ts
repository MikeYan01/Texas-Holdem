// The five personalities, as constants on one shared comparison.
//
// Two axes, exactly as CONTEXT.md describes them: loose/tight is how much Equity
// above Pot Odds is demanded before calling, passive/aggressive is how much more
// is demanded before raising instead. Nothing here is tuned against a solver;
// these are the knobs of "an amateur who understands basic odds", which is what
// ADR-0003 asked for and explicitly refused to improve on.

import type { Personality, PersonalityKey } from './types.ts';

export const PERSONALITIES: Record<PersonalityKey, Personality> = {
  // Tight and aggressive: plays few hands, but bets them.
  TAG: {
    key: 'TAG',
    preflopCallMargin: 0.14,
    postflopCallMargin: 0.07,
    raiseMargin: 0.1,
    openingRange: 0.1,
    semiBluffAppetite: 0.35,
    gambleAppetite: 0.8,
    equityNoise: 0.05,
    bluffFrequency: 0.1,
    betSizing: { min: 0.5, max: 0.85 },
  },
  // Loose and aggressive: enters wide and keeps applying pressure.
  LAG: {
    key: 'LAG',
    preflopCallMargin: 0.04,
    postflopCallMargin: 0.01,
    raiseMargin: 0.04,
    openingRange: 0.2,
    semiBluffAppetite: 0.5,
    gambleAppetite: 1.6,
    equityNoise: 0.09,
    bluffFrequency: 0.26,
    betSizing: { min: 0.45, max: 1.1 },
  },
  // Loose and passive: wants to see everything, almost never raises.
  CallingStation: {
    key: 'CallingStation',
    preflopCallMargin: 0.02,
    postflopCallMargin: -0.03,
    raiseMargin: 0.4,
    openingRange: 0.02,
    semiBluffAppetite: 0.05,
    gambleAppetite: 0.15,
    equityNoise: 0.07,
    bluffFrequency: 0.01,
    betSizing: { min: 0.3, max: 0.5 },
  },
  // Tight and passive: only the strongest hands, and it hardly ever bluffs.
  Rock: {
    key: 'Rock',
    preflopCallMargin: 0.22,
    postflopCallMargin: 0.13,
    raiseMargin: 0.26,
    openingRange: 0.03,
    semiBluffAppetite: 0.15,
    gambleAppetite: 0,
    equityNoise: 0.03,
    bluffFrequency: 0.02,
    betSizing: { min: 0.4, max: 0.65 },
  },
  // Bets and raises far more than its cards justify, but does not pay off when
  // it misses. Its job is the one the table would otherwise lack: without
  // somebody who might have anything, "is this a bluff?" never gets asked.
  //
  // Note what it does NOT do — call below the price. An earlier version of this
  // seat demanded 4% equity where the pot odds were 20%, so every call it ever
  // made lost money by construction, and it shipped 5 BB a hand to everyone
  // else. Aggression is a style; calling at a loss is just a leak.
  Bluffer: {
    key: 'Bluffer',
    preflopCallMargin: 0.12,
    postflopCallMargin: 0.06,
    raiseMargin: 0.01,
    openingRange: 0.24,
    semiBluffAppetite: 0.6,
    gambleAppetite: 2.0,
    equityNoise: 0.11,
    bluffFrequency: 0.3,
    betSizing: { min: 0.55, max: 1.2 },
  },
};

/** One of each, which is the whole line-up. There is no difficulty setting. */
export const PERSONALITY_KEYS: readonly PersonalityKey[] = [
  'TAG',
  'LAG',
  'CallingStation',
  'Rock',
  'Bluffer',
];
