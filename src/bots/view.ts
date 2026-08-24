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
    bigBlind: state.config.bigBlind,
    legalActions: state.legalActions,
  };
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
