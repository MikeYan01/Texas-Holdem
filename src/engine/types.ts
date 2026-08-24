// The engine's vocabulary: state, actions, events.
//
// Two properties matter more than anything else here (ADR-0001):
//
//   1. The state is an explicit, directly constructible value. A test can write a
//      mid-hand position as a literal and call `reduce` on it, instead of having
//      to play the cards to get there.
//   2. `reduce` is pure. That is why the RNG lives on the state as a plain number
//      rather than as a closure, and why the engine never reads a clock.
//
// The engine emits structured events only. Not one string in here is meant for a
// human to read; the render layer turns these into Chinese (see AGENTS.md).

import type { Card } from '../poker-math/cards.ts';
import type { HandValue } from '../poker-math/evaluate-hand.ts';
import type { RngState } from '../poker-math/rng.ts';

export const STREETS = ['preflop', 'flop', 'turn', 'river'] as const;
export type Street = (typeof STREETS)[number];

/** How many community cards each street adds. */
export const STREET_CARD_COUNT: Record<Street, number> = {
  preflop: 0,
  flop: 3,
  turn: 1,
  river: 1,
};

export type SeatState = {
  readonly index: number;
  /** Chips in front of this Seat for the current Hand. Bounded; defines all-in. */
  readonly stack: number;
  /**
   * Everything this Seat has ever bought in for: the starting Stack plus every
   * Rebuy. Score is `stack - boughtIn`, which is why the six Scores sum to zero
   * without anyone having to maintain that by hand (ADR-0002).
   */
  readonly boughtIn: number;
  readonly holeCards: readonly [Card, Card] | null;
  readonly folded: boolean;
  /** Chips put in during this Hand, across all Streets. */
  readonly committed: number;
  /** Chips put in during the current Street. Reset each Street. */
  readonly streetCommitted: number;
  /** Has acted since the last aggressive action on this Street. */
  readonly hasActed: boolean;
  /**
   * The bet level this Seat was facing when it last acted on this Street, or
   * null if it has not acted yet. This is what decides whether a later raise
   * reopens its right to re-raise: the betting is open to it again only once the
   * bet has climbed by a full raise *since it last acted*.
   *
   * Tracking the level rather than a boolean is what makes successive short
   * all-ins come out right. Two all-ins of half a raise each do not reopen
   * anything on their own, but together they clear a full raise and do.
   */
  readonly facedBet: number | null;
};

/** Net win/loss across the whole Session. May be negative. Sums to zero. */
export const scoreOf = (seat: SeatState): number => seat.stack - seat.boughtIn;

/** Still in the Hand and still able to act. */
export const canStillAct = (seat: SeatState): boolean => !seat.folded && seat.stack > 0;

/**
 * Whether this Seat may raise, as opposed to only calling or folding.
 *
 * A Seat that has not acted this Street may always raise. One that has may only
 * raise again if the bet has gone up by at least a full raise since — which is
 * why an all-in for less than a full raise has to be called but does not reopen
 * the betting, and why two such all-ins in a row do reopen it.
 */
export function bettingIsOpenFor(
  seat: SeatState,
  currentBet: number,
  minRaiseIncrement: number,
): boolean {
  if (seat.facedBet === null) return true;
  return currentBet - seat.facedBet >= minRaiseIncrement;
}

export type Pot = {
  readonly amount: number;
  /** Seats entitled to contest this pot. A short stack is not in the side pots. */
  readonly eligibleSeats: readonly number[];
};

export type SessionPhase =
  /** Between Hands. `advance` deals the next one. */
  | 'awaiting-hand'
  /** `actorSeat` owes an action. Only a player action is legal. */
  | 'awaiting-action'
  /** Community cards are owed. `advance` deals them; the UI paces this. */
  | 'awaiting-deal'
  /** Betting is over and the board is complete. `advance` settles the pots. */
  | 'awaiting-showdown'
  /** Pots are pushed. Reveal happens here. `advance` starts the next Hand. */
  | 'hand-complete'
  /** Thirty Hands played. Nothing further is legal. */
  | 'session-complete';

export type SessionConfig = {
  readonly seatCount: number;
  readonly startingStack: number;
  readonly smallBlind: number;
  readonly bigBlind: number;
  readonly handsPerSession: number;
};

export const DEFAULT_CONFIG: SessionConfig = {
  seatCount: 6,
  startingStack: 200,
  smallBlind: 1,
  bigBlind: 2,
  // Two Orbits. Long enough that position comes round and the Bots show their
  // habits, short enough to finish in one sitting.
  handsPerSession: 12,
};

/**
 * Everything the UI needs in order to enable or disable a control. The UI must
 * not work any of this out for itself — the amounts are rules, and rules belong
 * inside the test seam (ADR-0001).
 *
 * All `*To` amounts are **totals for the current Street**, matching how a raise
 * is spoken: "raise to 12", not "raise by 8".
 */
export type LegalActions = {
  readonly seat: number;
  readonly canFold: boolean;
  readonly canCheck: boolean;
  readonly canCall: boolean;
  /** Extra chips needed to call. Zero when checking is free. */
  readonly callAmount: number;
  /** True when nothing has been bet this Street, so the opening bet is a "bet". */
  readonly canBet: boolean;
  readonly canRaise: boolean;
  /**
   * Whether pushing is legal right now. Not the same as having chips: a Seat
   * facing an under-sized all-in raise may only match it, and nobody may push
   * into a pot where every other Seat is already all-in or folded.
   */
  readonly canAllIn: boolean;
  /** Smallest legal raise-to. Meaningless unless `canBet || canRaise`. */
  readonly minRaiseTo: number;
  /** Largest legal raise-to: this Seat's whole Stack. */
  readonly maxRaiseTo: number;
  /** Always available while the Seat has chips: the right to push. */
  readonly allInTo: number;
  /**
   * Ready-made sizings, already clamped to the legal range, so the UI can render
   * three buttons without doing arithmetic.
   */
  readonly presets: {
    readonly halfPot: number;
    readonly pot: number;
    readonly allIn: number;
  };
};

export type PlayerAction =
  | { readonly type: 'fold' }
  | { readonly type: 'check' }
  | { readonly type: 'call' }
  /** Opening a Street. `to` is the total for the Street. */
  | { readonly type: 'bet'; readonly to: number }
  /** Raising an existing bet. `to` is the total for the Street. */
  | { readonly type: 'raise'; readonly to: number }
  | { readonly type: 'all-in' };

/**
 * `advance` performs exactly one non-player step: deal a Hand, deal a Street,
 * settle the pots, or finish the Hand. One step per action is what lets the UI
 * pace the table without the engine ever owning a timer.
 */
export type EngineAction = PlayerAction | { readonly type: 'advance' };

export type ActionKind = PlayerAction['type'];

export type PotWinner = {
  readonly seat: number;
  readonly amount: number;
  /** Null when the pot was taken without a showdown. */
  readonly handValue: HandValue | null;
  readonly bestFive: readonly Card[] | null;
};

export type GameEvent =
  | {
      readonly type: 'hand-started';
      readonly handNumber: number;
      readonly orbit: number;
      readonly buttonSeat: number;
    }
  | {
      readonly type: 'blind-posted';
      readonly seat: number;
      readonly amount: number;
      readonly blind: 'small' | 'big';
      readonly allIn: boolean;
    }
  | { readonly type: 'hole-cards-dealt'; readonly seats: readonly number[] }
  | {
      readonly type: 'acted';
      readonly seat: number;
      readonly action: ActionKind;
      /** Chips that left the Stack for this action. */
      readonly paid: number;
      /** The Seat's total for the Street after acting — the number to display. */
      readonly totalThisStreet: number;
      readonly allIn: boolean;
    }
  | { readonly type: 'street-dealt'; readonly street: Street; readonly cards: readonly Card[] }
  /** A bet nobody could call comes back. Without this, chips would vanish. */
  | { readonly type: 'uncalled-returned'; readonly seat: number; readonly amount: number }
  /** Everyone left is all-in: these Seats' cards turn face up before the run-out. */
  | { readonly type: 'all-in-runout'; readonly seats: readonly number[] }
  | { readonly type: 'showdown'; readonly seats: readonly number[] }
  | {
      readonly type: 'pot-awarded';
      readonly potIndex: number;
      readonly amount: number;
      /**
       * Who was entitled to contest this pot. Carried so the table can explain
       * the otherwise baffling case of two winners in one Hand: the best hand at
       * the table can be all-in short, take the main pot, and have no claim on a
       * side pot it never had the chips to contest.
       */
      readonly eligibleSeats: readonly number[];
      readonly winners: readonly PotWinner[];
      /** Who took the indivisible remainder, if there was one. */
      readonly oddChipSeat: number | null;
    }
  | { readonly type: 'hand-complete'; readonly handNumber: number }
  | { readonly type: 'rebuy'; readonly seat: number; readonly amount: number }
  | { readonly type: 'session-complete' };

export type SessionState = {
  readonly config: SessionConfig;
  readonly rngState: RngState;
  readonly phase: SessionPhase;
  /** 0 before the first Hand, then 1..handsPerSession. */
  readonly handNumber: number;
  /** 0 before the first Hand, then 1..5. One Orbit is one lap of the Button. */
  readonly orbit: number;
  /** The Button for the Hand now in progress, or for the next one between Hands. */
  readonly buttonSeat: number;
  /** Which Seat the human occupies. Randomised once per Session. */
  readonly playerSeat: number;
  readonly seats: readonly SeatState[];
  readonly street: Street;
  readonly board: readonly Card[];
  readonly deck: readonly Card[];
  /** How far into `deck` the dealing has got. */
  readonly dealtCount: number;
  readonly actorSeat: number | null;
  /** Highest `streetCommitted` on the current Street. */
  readonly currentBet: number;
  /** Size of the last full raise; the floor for the next one. */
  readonly lastRaiseSize: number;
  /** Main pot first, then side pots. Derived from commitments after every step. */
  readonly pots: readonly Pot[];
  /** Seats whose hole cards are legitimately face up right now. */
  readonly revealedSeats: readonly number[];
  readonly legalActions: LegalActions | null;
  /** Emitted by the step that produced this state. Not cumulative. */
  readonly events: readonly GameEvent[];
};

export class IllegalActionError extends Error {
  readonly code: string;

  constructor(code: string, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'IllegalActionError';
    this.code = code;
  }
}
