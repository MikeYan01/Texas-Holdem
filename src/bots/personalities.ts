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
    equityNoise: 0.03,
    bluffFrequency: 0.02,
    betSizing: { min: 0.4, max: 0.65 },
  },
  // LAG taken to its limit. Its job is to generate noise: without something at
  // the table that might have anything, "is this a bluff?" never gets asked.
  Maniac: {
    key: 'Maniac',
    preflopCallMargin: -0.06,
    postflopCallMargin: -0.08,
    raiseMargin: -0.03,
    equityNoise: 0.17,
    bluffFrequency: 0.46,
    betSizing: { min: 0.6, max: 1.4 },
  },
};

/** One of each, which is the whole line-up. There is no difficulty setting. */
export const PERSONALITY_KEYS: readonly PersonalityKey[] = [
  'TAG',
  'LAG',
  'CallingStation',
  'Rock',
  'Maniac',
];
