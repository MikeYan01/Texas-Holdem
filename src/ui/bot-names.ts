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
import type { Locale } from './text/locale.ts';

/**
 * Surnames, because a Seat plate is 158px wide and everyone knows them. They are
 * the same in every language: transliterating a real person's name would make
 * the table harder to talk about, not easier.
 */
export const BOT_NAMES = ['Brunson', 'Ivey', 'Negreanu', 'Dwan', 'Hellmuth'] as const;

export const PLAYER_NAMES: Record<Locale, string> = { zh: '你', en: 'You' };

export const playerName = (locale: Locale): string => PLAYER_NAMES[locale];

/**
 * A Seat with no name of its own.
 *
 * Unreachable while every Bot Seat is handed one, but a Seat labelled with
 * nothing at all would be worse than a numbered one — and it lives here rather
 * than at the call site because this is the module that owns Seat labels.
 */
export const unnamedSeatName = (seat: number, locale: Locale): string =>
  locale === 'zh' ? `${seat + 1} 号位` : `Seat ${seat + 1}`;

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
