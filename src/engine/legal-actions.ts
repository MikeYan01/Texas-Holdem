// What the Seat to act is allowed to do, and exactly how much each option costs.
//
// Every number here is a rule, so every number belongs inside the engine's test
// seam (ADR-0001). The UI enables and disables buttons from this and does no
// arithmetic of its own — not even halving the pot.

import { bettingIsOpenFor, canStillAct, type LegalActions, type SeatState } from './types.ts';

export type LegalActionsInput = {
  readonly seats: readonly SeatState[];
  readonly actorSeat: number;
  readonly currentBet: number;
  readonly lastRaiseSize: number;
  readonly bigBlind: number;
};

export function computeLegalActions(input: LegalActionsInput): LegalActions {
  const { seats, actorSeat, currentBet, lastRaiseSize } = input;
  const seat = seats[actorSeat];
  if (!seat) throw new Error(`no such seat: ${actorSeat}`);

  const owed = currentBet - seat.streetCommitted;
  const callAmount = Math.max(0, Math.min(owed, seat.stack));
  const canCheck = owed <= 0;
  const maxRaiseTo = seat.streetCommitted + seat.stack;

  // A full raise has to lift the bet by at least as much as the last raise did.
  const minRaiseIncrement = Math.max(lastRaiseSize, input.bigBlind);
  const minRaiseTo = currentBet + minRaiseIncrement;

  // Nobody may bet into a dry pot: if every other Seat is folded or all-in there
  // is no one left to call, so the only choices are to match what is owed or not.
  const othersCanAct = seats.some((other) => other.index !== actorSeat && canStillAct(other));
  const reopened = bettingIsOpenFor(seat, currentBet, minRaiseIncrement);
  const aggressionPossible =
    seat.stack > 0 && othersCanAct && reopened && maxRaiseTo >= minRaiseTo;

  // Pushing for less than the current bet is just a call for everything left, and
  // is always allowed. Pushing for more is aggression, and has to clear the same
  // bar as a raise — except the minimum, which a shove is allowed to fall short of.
  const shoveWouldRaise = maxRaiseTo > currentBet;
  const canAllIn = seat.stack > 0 && (shoveWouldRaise ? othersCanAct && reopened : !canCheck);

  // Pot-sized raise: call first, then put in what the pot would then hold.
  const potTotal = seats.reduce((sum, other) => sum + other.committed, 0);
  const potAfterCall = potTotal + Math.max(0, owed);
  const clamp = (raiseTo: number): number => {
    if (maxRaiseTo <= minRaiseTo) return maxRaiseTo; // only a shove is available
    return Math.min(maxRaiseTo, Math.max(minRaiseTo, Math.round(raiseTo)));
  };

  return {
    seat: actorSeat,
    // Folding is always allowed. Folding when checking is free is a bad play, not
    // an illegal one, and the engine does not police bad plays.
    canFold: true,
    canCheck,
    canCall: !canCheck && seat.stack > 0,
    callAmount,
    canBet: currentBet === 0 && aggressionPossible,
    canRaise: currentBet > 0 && aggressionPossible,
    canAllIn,
    minRaiseTo,
    maxRaiseTo,
    allInTo: maxRaiseTo,
    presets: {
      halfPot: clamp(currentBet + potAfterCall / 2),
      pot: clamp(currentBet + potAfterCall),
      allIn: maxRaiseTo,
    },
  };
}
