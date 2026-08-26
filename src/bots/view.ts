// Projecting the engine state down to what one Seat may see.

import type { Rng } from '../poker-math/rng.ts';
import { shuffleInPlace } from '../poker-math/rng.ts';
import type { SessionState } from '../engine/types.ts';
import { PERSONALITY_KEYS } from './personalities.ts';
import type { BotView, PersonalityKey } from './types.ts';

/**
 * The view for one Seat. Throws rather than degrading if asked for a Seat that
 * cannot act: a Bot should never be consulted out of turn.
 */
export function makeBotView(state: SessionState, seatIndex: number): BotView {
  const seat = state.seats[seatIndex];
  if (!seat) throw new Error(`no such seat: ${seatIndex}`);
  if (!seat.holeCards) throw new Error(`seat ${seatIndex} has no cards`);
  if (!state.legalActions || state.legalActions.seat !== seatIndex) {
    throw new Error(`seat ${seatIndex} is not to act`);
  }

  return {
    seat: seatIndex,
    holeCards: seat.holeCards,
    board: state.board,
    street: state.street,
    potTotal: state.seats.reduce((sum, other) => sum + other.committed, 0),
    opponentCount: state.seats.filter((other) => !other.folded && other.index !== seatIndex).length,
    currentBet: state.currentBet,
    stack: seat.stack,
    position: positionOf(state, seatIndex),
    wasAggressor: state.lastStreetAggressor === seatIndex,
    bigBlind: state.config.bigBlind,
    legalActions: state.legalActions,
  };
}

/**
 * How late a Seat acts among those still in the Hand: 0 first, 1 last.
 *
 * Measured on the order used after the flop — clockwise from the Button — which
 * is the order that decides three Streets out of four. Before the flop the
 * blinds act last on that one Street, but they are out of position for the rest
 * of the Hand, and it is the rest of the Hand that makes the Button the best
 * Seat to enter a pot from.
 */
function positionOf(state: SessionState, seatIndex: number): number {
  const n = state.config.seatCount;
  const live: number[] = [];
  for (let i = 0; i < n; i++) {
    const index = (state.buttonSeat + 1 + i) % n;
    if (!state.seats[index]!.folded) live.push(index);
  }
  const place = live.indexOf(seatIndex);
  if (place < 0 || live.length < 2) return 1;
  return place / (live.length - 1);
}

/**
 * One Bot of each personality, in random Seats, with the Player somewhere among
 * them. Fixed line-up by design (issue 13): a difficulty slider sounds cheap but
 * means tuning and validating every notch, and "one of each" already guarantees a
 * tight player, a loose one, a station and a maniac at the table every Session.
 */
export function assignPersonalities(
  seatCount: number,
  playerSeat: number,
  rng: Rng,
): ReadonlyMap<number, PersonalityKey> {
  const botSeats = Array.from({ length: seatCount }, (_, i) => i).filter((i) => i !== playerSeat);
  const keys = shuffleInPlace([...PERSONALITY_KEYS], rng);
  return new Map(botSeats.map((seat, i) => [seat, keys[i % keys.length]!]));
}
