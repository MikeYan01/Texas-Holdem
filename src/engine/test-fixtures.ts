// Fixtures for engine tests.
//
// The point of the engine being a pure reducer over an explicit state is that a
// test can write down the position it cares about instead of playing dozens of
// actions to reach it. `positionAt` is that: hand a partial description of a
// table, get back a state you can call `reduce` on.

import { parseCards, type Card } from '../poker-math/cards.ts';
import { computeLegalActions } from './legal-actions.ts';
import { buildPots } from './pots.ts';
import {
  DEFAULT_CONFIG,
  type SeatState,
  type SessionConfig,
  type SessionPhase,
  type SessionState,
  type Street,
} from './types.ts';

export type SeatSpec = {
  readonly stack: number;
  readonly boughtIn?: number;
  /** `'Ah Kd'`, or omitted to leave the Seat with no cards. */
  readonly hole?: string;
  readonly folded?: boolean;
  readonly committed?: number;
  readonly streetCommitted?: number;
  readonly hasActed?: boolean;
  /** The bet level this Seat last acted against; null means it has not acted. */
  readonly facedBet?: number | null;
};

export type PositionSpec = {
  readonly seats: readonly SeatSpec[];
  readonly buttonSeat?: number;
  readonly playerSeat?: number;
  readonly street?: Street;
  /** `'Ah Kd 2c'`. */
  readonly board?: string;
  readonly actorSeat?: number | null;
  readonly currentBet?: number;
  readonly streetAggressor?: number | null;
  readonly lastStreetAggressor?: number | null;
  readonly lastRaiseSize?: number;
  readonly phase?: SessionPhase;
  readonly deck?: string;
  readonly handNumber?: number;
  readonly config?: Partial<SessionConfig>;
  readonly revealedSeats?: readonly number[];
  readonly rngState?: number;
};

/**
 * Build a mid-hand state directly. `committed` defaults to `streetCommitted`, so
 * a single-street scenario only has to state one number per Seat.
 */
export function positionAt(spec: PositionSpec): SessionState {
  const config: SessionConfig = {
    ...DEFAULT_CONFIG,
    seatCount: spec.seats.length,
    ...spec.config,
  };

  const seats: SeatState[] = spec.seats.map((seat, index) => {
    const streetCommitted = seat.streetCommitted ?? 0;
    const hole = seat.hole ? parseCards(seat.hole) : null;
    return {
      index,
      stack: seat.stack,
      boughtIn: seat.boughtIn ?? config.startingStack,
      holeCards: hole ? [hole[0]!, hole[1]!] : null,
      folded: seat.folded ?? false,
      committed: seat.committed ?? streetCommitted,
      streetCommitted,
      hasActed: seat.hasActed ?? false,
      // Default: a Seat marked as having acted faced whatever it has matched.
      facedBet: seat.facedBet === undefined ? (seat.hasActed ? streetCommitted : null) : seat.facedBet,
    };
  });

  const board: Card[] = spec.board ? parseCards(spec.board) : [];
  const currentBet = spec.currentBet ?? Math.max(0, ...seats.map((s) => s.streetCommitted));
  const lastRaiseSize = spec.lastRaiseSize ?? config.bigBlind;
  const actorSeat = spec.actorSeat === undefined ? 0 : spec.actorSeat;
  const phase = spec.phase ?? (actorSeat === null ? 'awaiting-deal' : 'awaiting-action');
  const handNumber = spec.handNumber ?? 1;

  return {
    config,
    rngState: spec.rngState ?? 1,
    phase,
    handNumber,
    orbit: Math.floor((handNumber - 1) / config.seatCount) + 1,
    buttonSeat: spec.buttonSeat ?? 0,
    playerSeat: spec.playerSeat ?? 0,
    seats,
    street: spec.street ?? 'preflop',
    board,
    // Cards still to come. Tests that need a specific run-out say so; the rest
    // get a deterministic filler that avoids everything already on the table.
    deck: spec.deck ? parseCards(spec.deck) : unusedCards(seats, board),
    dealtCount: 0,
    actorSeat,
    currentBet,
    streetAggressor: spec.streetAggressor ?? null,
    lastStreetAggressor: spec.lastStreetAggressor ?? null,
    lastRaiseSize,
    pots: buildPots(seats),
    revealedSeats: [...(spec.revealedSeats ?? [])],
    legalActions:
      phase === 'awaiting-action' && actorSeat !== null
        ? computeLegalActions({
            seats,
            actorSeat,
            currentBet,
            lastRaiseSize,
            bigBlind: config.bigBlind,
          })
        : null,
    events: [],
  };
}

function unusedCards(seats: readonly SeatState[], board: readonly Card[]): Card[] {
  const used = new Set<Card>(board);
  for (const seat of seats) for (const card of seat.holeCards ?? []) used.add(card);
  return Array.from({ length: 52 }, (_, i) => i).filter((card) => !used.has(card));
}
