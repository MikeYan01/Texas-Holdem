// Read-only views over the state, for the render layer.
//
// The one that matters is `visibleHoleCards`. "You never see a Bot's hole cards
// during the Hand" is the rule that keeps the game worth playing, so it is
// expressed here as a testable function rather than left to the discipline of
// whoever writes the next component.

import type { Card } from '../poker-math/cards.ts';
import { buildPots } from './pots.ts';
import { scoreOf, type Pot, type SeatState, type SessionState } from './types.ts';

/**
 * The cards this viewer may legitimately see at this Seat, or null.
 *
 * Face up in exactly three situations: they are your own; the Seat turned them
 * over for an all-in run-out or a showdown; or the Hand is settled and Reveal is
 * showing every Seat, including everyone who folded.
 */
export function visibleHoleCards(
  state: SessionState,
  seatIndex: number,
): readonly [Card, Card] | null {
  const seat = state.seats[seatIndex];
  if (!seat?.holeCards) return null;
  if (seatIndex === state.playerSeat) return seat.holeCards;
  if (state.revealedSeats.includes(seatIndex)) return seat.holeCards;
  return null;
}

/**
 * The pots as a table shows them: only chips already gathered into the middle,
 * with the current Street's betting still sitting in front of the Seats who bet
 * it.
 *
 * `state.pots` is the settlement-accurate decomposition and includes the current
 * Street, which makes it wrong for display in two ways. It double-counts against
 * the bet in front of each Seat, and mid-Street it splits off a band that only
 * one Seat is eligible for — so before anyone has even acted, an unmatched big
 * blind shows up as a side pot that nobody is contesting.
 */
export function displayPots(state: SessionState): readonly Pot[] {
  const gathered = state.seats.map((seat) => ({
    ...seat,
    committed: seat.committed - seat.streetCommitted,
    streetCommitted: 0,
  }));
  return buildPots(gathered);
}

/** Everything in the middle, bets included — the number to read pot odds off. */
export const potForOdds = (state: SessionState): number =>
  state.seats.reduce((sum, seat) => sum + seat.committed, 0);

/** Seats ranked for the results screen: best Score first, ties broken by Seat. */
export function rankingByScore(state: SessionState): readonly SeatState[] {
  return [...state.seats].sort((a, b) => scoreOf(b) - scoreOf(a) || a.index - b.index);
}

/** The invariant from ADR-0002. Always zero, at every moment, no exceptions. */
export const scoreSum = (state: SessionState): number =>
  state.seats.reduce((sum, seat) => sum + scoreOf(seat), 0);

/** Chips on the table: Stacks plus everything committed to the middle. */
export const chipsInPlay = (state: SessionState): number =>
  state.seats.reduce((sum, seat) => sum + seat.stack + seat.committed, 0);

export const isPlayerToAct = (state: SessionState): boolean =>
  state.phase === 'awaiting-action' && state.actorSeat === state.playerSeat;

