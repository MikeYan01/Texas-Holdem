// Display names for the five Bots.
//
// Two deliberate properties:
//
//   * These are labels and nothing more. A name is assigned to a Seat with no
//     regard to which personality sits there, so nothing here claims anything
//     about how the real player plays — "Calling Station" is a losing style and
//     it would be both rude and false to pin it on someone.
//   * The assignment is reshuffled every Session. Working out who is tight and
//     who is bluffing is most of what there is to learn at this table, and a name
//     that always played the same way would hand you that for free after one or
//     two Sessions.

import { shuffleInPlace, type Rng } from '../poker-math/rng.ts';

/** Surnames, because a Seat plate is 158px wide and everyone knows them. */
export const BOT_NAMES = ['Brunson', 'Ivey', 'Negreanu', 'Dwan', 'Hellmuth'] as const;

export const PLAYER_NAME = '你';

/**
 * A name per Bot Seat, leaving the Player's Seat alone. Seeded, so a Session
 * replays with the same table.
 */
export function assignBotNames(
  seatCount: number,
  playerSeat: number,
  rng: Rng,
): ReadonlyMap<number, string> {
  const botSeats = Array.from({ length: seatCount }, (_, i) => i).filter((i) => i !== playerSeat);
  const names = shuffleInPlace([...BOT_NAMES], rng);
  return new Map(botSeats.map((seat, i) => [seat, names[i % names.length]!]));
}
