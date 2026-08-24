// Pot construction and settlement — the most error-prone corner of a six-handed
// game, and the reason the project chose 6-max rather than avoiding it.
//
// The one design decision that removes most of the risk: pots are never
// accumulated incrementally. They are DERIVED from what each Seat has committed,
// every time anyone asks. There is no running total to drift out of step with
// the Seats, and a test can build any mid-hand position by writing commitments.

import type { Card } from '../poker-math/cards.ts';
import { bestFive, evaluateHand } from '../poker-math/evaluate-hand.ts';
import type { HandValue } from '../poker-math/evaluate-hand.ts';
import type { Pot, PotWinner, SeatState } from './types.ts';

/**
 * Split the committed chips into the main pot and any side pots.
 *
 * A Seat that is all-in for less than the current bet can only win up to what it
 * put in; everything above that level forms a pot it is not entitled to. Slicing
 * by commitment level is what produces that, and it produces any number of side
 * pots at once without special cases.
 *
 * Folded Seats' chips stay in the pots — they are lost, not returned — but folded
 * Seats are never eligible to win.
 */
export function buildPots(seats: readonly SeatState[]): Pot[] {
  const levels = [...new Set(seats.filter((s) => s.committed > 0).map((s) => s.committed))].sort(
    (a, b) => a - b,
  );

  const pots: Pot[] = [];
  let previousLevel = 0;

  for (const level of levels) {
    let amount = 0;
    for (const seat of seats) {
      amount += Math.max(0, Math.min(seat.committed, level) - previousLevel);
    }
    const eligibleSeats = seats
      .filter((seat) => !seat.folded && seat.committed >= level)
      .map((seat) => seat.index);

    if (amount > 0) {
      const previous = pots[pots.length - 1];
      // Bands with the same eligibility are one pot as far as anyone is
      // concerned; merging keeps the display honest and settlement simpler.
      if (previous && sameSeats(previous.eligibleSeats, eligibleSeats)) {
        pots[pots.length - 1] = { amount: previous.amount + amount, eligibleSeats };
      } else {
        pots.push({ amount, eligibleSeats });
      }
    }
    previousLevel = level;
  }

  return pots;
}

const sameSeats = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((seat, i) => seat === b[i]);

export const totalPot = (pots: readonly Pot[]): number =>
  pots.reduce((sum, pot) => sum + pot.amount, 0);

/**
 * The part of a Street's betting that nobody could match, and its owner.
 *
 * If one Seat put in more than everyone else on a Street, the excess was never
 * called and comes back. Without this the chips would sit in a pot that only its
 * own contributor is eligible for — which settles to the same number, but shows a
 * phantom side pot on the table and, worse, leaves the invariant depending on a
 * subtlety instead of on an explicit rule.
 */
export function uncalledStreetExcess(
  seats: readonly SeatState[],
): { readonly seat: number; readonly amount: number } | null {
  let top = 0;
  let second = 0;
  let topSeat = -1;
  for (const seat of seats) {
    if (seat.streetCommitted > top) {
      second = top;
      top = seat.streetCommitted;
      topSeat = seat.index;
    } else if (seat.streetCommitted > second) {
      second = seat.streetCommitted;
    }
  }
  if (topSeat < 0 || top <= second) return null;
  return { seat: topSeat, amount: top - second };
}

/**
 * A safety net for settlement: nobody can have more in the middle than the
 * deepest Seat still contesting it. `uncalledStreetExcess` should already have
 * seen to this Street by Street; this makes it structurally impossible for a
 * band of chips to exist that no live Seat is eligible for, which is the one way
 * chips could silently disappear.
 */
export function excessOverLiveCommitment(
  seats: readonly SeatState[],
): { readonly seat: number; readonly amount: number }[] {
  let deepestLive = 0;
  for (const seat of seats) {
    if (!seat.folded && seat.committed > deepestLive) deepestLive = seat.committed;
  }
  return seats
    .filter((seat) => seat.committed > deepestLive)
    .map((seat) => ({ seat: seat.index, amount: seat.committed - deepestLive }));
}

export type PotAward = {
  readonly potIndex: number;
  readonly amount: number;
  readonly eligibleSeats: readonly number[];
  readonly winners: readonly PotWinner[];
  readonly oddChipSeat: number | null;
};

/**
 * Decide who takes each pot.
 *
 * Every pot is settled independently, by the strongest hand among the Seats
 * entitled to it — which is how a short stack can win the main pot and still have
 * no claim on the side pot above it.
 *
 * `seatOrderFromButton` fixes where an indivisible remainder goes: the first
 * winner clockwise from the Button. Some rule has to decide, and it has to be a
 * rule rather than a coincidence, because chips must not evaporate.
 */
export function awardPots(
  pots: readonly Pot[],
  seats: readonly SeatState[],
  board: readonly Card[],
  seatOrderFromButton: readonly number[],
): PotAward[] {
  const strength = new Map<number, HandValue>();
  const winningCards = new Map<number, readonly Card[]>();

  const handOf = (seat: SeatState): readonly Card[] => [...(seat.holeCards ?? []), ...board];

  for (const seat of seats) {
    if (seat.folded || seat.holeCards === null) continue;
    const cards = handOf(seat);
    if (cards.length < 5) continue; // No showdown is possible; pots go uncontested.
    strength.set(seat.index, evaluateHand(cards));
    winningCards.set(seat.index, bestFive(cards));
  }

  return pots.map((pot, potIndex) => {
    const contenders = pot.eligibleSeats;

    // Uncontested: one Seat left, or a board too short to evaluate. This also
    // covers a bet nobody called, where the lone eligible Seat is getting its own
    // chips back.
    if (contenders.length <= 1 || contenders.some((seat) => !strength.has(seat))) {
      const winner = contenders[0];
      if (winner === undefined) {
        return { potIndex, amount: pot.amount, eligibleSeats: contenders, winners: [], oddChipSeat: null };
      }
      return {
        potIndex,
        amount: pot.amount,
        eligibleSeats: contenders,
        winners: [{ seat: winner, amount: pot.amount, handValue: null, bestFive: null }],
        oddChipSeat: null,
      };
    }

    const best = Math.max(...contenders.map((seat) => strength.get(seat)!));
    const winners = contenders.filter((seat) => strength.get(seat) === best);

    const share = Math.floor(pot.amount / winners.length);
    const remainder = pot.amount - share * winners.length;
    const oddChipSeat =
      remainder > 0 ? (seatOrderFromButton.find((seat) => winners.includes(seat)) ?? null) : null;

    return {
      potIndex,
      amount: pot.amount,
      eligibleSeats: contenders,
      winners: winners.map((seat) => ({
        seat,
        amount: share + (seat === oddChipSeat ? remainder : 0),
        handValue: strength.get(seat)!,
        bestFive: winningCards.get(seat) ?? null,
      })),
      oddChipSeat,
    };
  });
}
