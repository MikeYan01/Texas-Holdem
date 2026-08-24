// What a Bot is allowed to know.
//
// The hard constraint (issue 07) is that `BotView` cannot carry another Seat's
// hole cards. Not "must not" — cannot. There is no field for them, so cheating is
// a type error rather than a matter of discipline, and it stays that way however
// the projection is later extended.

import type { Card } from '../poker-math/cards.ts';
import type { Rng } from '../poker-math/rng.ts';
import type { LegalActions, Street } from '../engine/types.ts';

export type PersonalityKey = 'TAG' | 'LAG' | 'CallingStation' | 'Rock' | 'Bluffer';

/**
 * The five Bots run the same logic; a personality is nothing but a handful of
 * constants offsetting the same comparison (ADR-0003). There is no branch on the
 * personality key anywhere in the decision.
 */
export type Personality = {
  readonly key: PersonalityKey;
  /**
   * Equity required above Pot Odds before calling before the flop. This is how
   * "tight" and "loose" are expressed, and because it is added to Pot Odds rather
   * than used as an absolute number, a big enough pot still gets called — the
   * whole point of ADR-0003.
   */
  readonly preflopCallMargin: number;
  /** The same, after the flop, where ranges are already narrowed. */
  readonly postflopCallMargin: number;
  /**
   * Equity required above an even share of the pot before raising rather than
   * calling. This is "passive" versus "aggressive".
   */
  readonly raiseMargin: number;
  /**
   * How badly this Bot misreads its own Equity. Bots must not play off a perfect
   * number: they would call too much and read as mechanical (ADR-0005). The noise
   * also makes the sampling error of 2000 iterations harmless.
   */
  readonly equityNoise: number;
  /**
    * How often it fires with nothing, heads-up. Scaled down by the number of
    * opponents at the point of use: a bluff needs everyone to fold, so betting
    * into five players as often as into one is not a style, it is a donation.
    */
  readonly bluffFrequency: number;
  /** Bet size as a fraction of the pot. A range, so sizing is not one number. */
  readonly betSizing: { readonly min: number; readonly max: number };
};

/**
 * Everything a Bot sees. Derived from the engine state, minus everything it is
 * not entitled to.
 */
export type BotView = {
  readonly seat: number;
  /** Its own two cards. There is deliberately nowhere to put anyone else's. */
  readonly holeCards: readonly [Card, Card];
  readonly board: readonly Card[];
  readonly street: Street;
  /** Chips in the middle, including this Street's betting. */
  readonly potTotal: number;
  /** Live opponents, which is what the Equity is against. */
  readonly opponentCount: number;
  readonly currentBet: number;
  readonly stack: number;
  readonly bigBlind: number;
  readonly legalActions: LegalActions;
};

/**
 * Equity behind an async boundary (ADR-0005). Injected rather than imported, so
 * a Bot test can hand over a fixed number and test the decision instead of the
 * Monte Carlo, and so moving the real one into a Web Worker changes one file.
 */
export type EquityProvider = (request: {
  readonly hole: readonly [Card, Card];
  readonly board: readonly Card[];
  readonly opponentCount: number;
  readonly rng: Rng;
}) => Promise<number>;

export type BotDeps = {
  readonly equity: EquityProvider;
  readonly rng: Rng;
};
