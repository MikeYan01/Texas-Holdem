// The rules engine: `createSession` builds a starting state, `reduce` takes one
// step. Both are pure functions of explicit values.
//
// Two consequences worth stating out loud, because everything else follows from
// them:
//
//   * The engine never sleeps and owns no timer. Bot thinking time and the pace
//     of an all-in run-out are the UI's business; the engine only ever answers
//     "given this state and this action, what is the next state?".
//   * Randomness is a number on the state, not a closure. `reduce(s, a)` returns
//     the same thing every time, shuffles included, so any failing seed replays.

import type { Card } from '../poker-math/cards.ts';
import { FULL_DECK } from '../poker-math/cards.ts';
import { rngCursor, shuffleInPlace } from '../poker-math/rng.ts';
import { computeLegalActions } from './legal-actions.ts';
import {
  awardPots,
  buildPots,
  excessOverLiveCommitment,
  uncalledStreetExcess,
} from './pots.ts';
import {
  DEFAULT_CONFIG,
  IllegalActionError,
  STREETS,
  STREET_CARD_COUNT,
  bettingIsOpenFor,
  canStillAct,
  type EngineAction,
  type GameEvent,
  type PlayerAction,
  type SeatState,
  type SessionConfig,
  type SessionState,
} from './types.ts';

export type CreateSessionOptions = {
  readonly seed: number;
  readonly config?: Partial<SessionConfig>;
  /** Defaults to a random Seat, so the human is not always in the same place. */
  readonly playerSeat?: number;
};

type Draft = {
  -readonly [K in keyof SessionState]: SessionState[K];
} & {
  seats: SeatState[];
  board: Card[];
  events: GameEvent[];
  revealedSeats: number[];
};

const freshSeat = (index: number, startingStack: number): SeatState => ({
  index,
  stack: startingStack,
  boughtIn: startingStack,
  holeCards: null,
  folded: false,
  committed: 0,
  streetCommitted: 0,
  hasActed: false,
  facedBet: null,
});

export function createSession(options: CreateSessionOptions): SessionState {
  const config: SessionConfig = { ...DEFAULT_CONFIG, ...options.config };
  if (config.seatCount < 3) {
    throw new Error('seatCount must be at least 3; heads-up blind rules are out of scope');
  }

  const cursor = rngCursor(options.seed);
  const playerSeat = options.playerSeat ?? Math.floor(cursor.rng() * config.seatCount);
  const buttonSeat = Math.floor(cursor.rng() * config.seatCount);

  return {
    config,
    rngState: cursor.state(),
    phase: 'awaiting-hand',
    handNumber: 0,
    orbit: 0,
    buttonSeat,
    playerSeat,
    seats: Array.from({ length: config.seatCount }, (_, i) => freshSeat(i, config.startingStack)),
    street: 'preflop',
    board: [],
    deck: [],
    dealtCount: 0,
    actorSeat: null,
    currentBet: 0,
    lastRaiseSize: config.bigBlind,
    pots: [],
    revealedSeats: [],
    legalActions: null,
    events: [],
  };
}

export function reduce(state: SessionState, action: EngineAction): SessionState {
  const draft: Draft = {
    ...state,
    seats: [...state.seats],
    board: [...state.board],
    revealedSeats: [...state.revealedSeats],
    events: [],
  };

  if (action.type === 'advance') advance(draft);
  else applyPlayerAction(draft, action);

  return draft;
}

// ---------------------------------------------------------------------------
// Seat helpers
// ---------------------------------------------------------------------------

function patchSeat(draft: Draft, index: number, patch: Partial<SeatState>): void {
  const seat = draft.seats[index];
  if (!seat) throw new Error(`no such seat: ${index}`);
  draft.seats[index] = { ...seat, ...patch };
}

const seatAt = (draft: Draft, index: number): SeatState => {
  const seat = draft.seats[index];
  if (!seat) throw new Error(`no such seat: ${index}`);
  return seat;
};

/** Seats in acting order, starting immediately clockwise of the Button. */
function orderFromButton(draft: Draft): number[] {
  const n = draft.config.seatCount;
  return Array.from({ length: n }, (_, i) => (draft.buttonSeat + 1 + i) % n);
}

const liveSeats = (draft: Draft): SeatState[] => draft.seats.filter((seat) => !seat.folded);
const actionableSeats = (draft: Draft): SeatState[] => draft.seats.filter(canStillAct);

/** Move chips from a Stack into the middle, capped by the Stack. Returns what moved. */
function payChips(draft: Draft, index: number, requested: number): number {
  const seat = seatAt(draft, index);
  const paid = Math.max(0, Math.min(requested, seat.stack));
  patchSeat(draft, index, {
    stack: seat.stack - paid,
    committed: seat.committed + paid,
    streetCommitted: seat.streetCommitted + paid,
  });
  return paid;
}

function refreshPots(draft: Draft): void {
  draft.pots = buildPots(draft.seats);
}

function setActor(draft: Draft, index: number): void {
  draft.actorSeat = index;
  draft.phase = 'awaiting-action';
  draft.legalActions = computeLegalActions({
    seats: draft.seats,
    actorSeat: index,
    currentBet: draft.currentBet,
    lastRaiseSize: draft.lastRaiseSize,
    bigBlind: draft.config.bigBlind,
  });
}

function clearActor(draft: Draft): void {
  draft.actorSeat = null;
  draft.legalActions = null;
}

// ---------------------------------------------------------------------------
// advance: one non-player step
// ---------------------------------------------------------------------------

function advance(draft: Draft): void {
  switch (draft.phase) {
    case 'awaiting-hand':
      return startHand(draft);
    case 'awaiting-deal':
      return dealNextStreet(draft);
    case 'awaiting-showdown':
      return settleHand(draft);
    case 'hand-complete':
      return finishHand(draft);
    case 'awaiting-action':
      throw new IllegalActionError('action-required', `seat ${draft.actorSeat} owes an action`);
    case 'session-complete':
      throw new IllegalActionError('session-complete');
  }
}

function startHand(draft: Draft): void {
  const { seatCount, smallBlind, bigBlind } = draft.config;

  draft.handNumber += 1;
  draft.orbit = Math.floor((draft.handNumber - 1) / seatCount) + 1;
  draft.street = 'preflop';
  draft.board = [];
  draft.dealtCount = 0;
  draft.revealedSeats = [];
  draft.currentBet = bigBlind;
  draft.lastRaiseSize = bigBlind;

  for (const seat of draft.seats) {
    patchSeat(draft, seat.index, {
      holeCards: null,
      folded: false,
      committed: 0,
      streetCommitted: 0,
      hasActed: false,
      facedBet: null,
    });
  }

  const cursor = rngCursor(draft.rngState);
  draft.deck = shuffleInPlace([...FULL_DECK], cursor.rng);
  draft.rngState = cursor.state();

  draft.events.push({
    type: 'hand-started',
    handNumber: draft.handNumber,
    orbit: draft.orbit,
    buttonSeat: draft.buttonSeat,
  });

  const order = orderFromButton(draft);
  const smallBlindSeat = order[0]!;
  const bigBlindSeat = order[1]!;

  for (const [seat, amount, blind] of [
    [smallBlindSeat, smallBlind, 'small'],
    [bigBlindSeat, bigBlind, 'big'],
  ] as const) {
    const paid = payChips(draft, seat, amount);
    draft.events.push({
      type: 'blind-posted',
      seat,
      amount: paid,
      blind,
      allIn: seatAt(draft, seat).stack === 0,
    });
  }

  // Two cards each, one at a time round the table starting left of the Button —
  // the order a dealer would use, so the deal animation has something honest to
  // follow.
  const holeCards = new Map<number, Card[]>(order.map((seat) => [seat, []]));
  for (let round = 0; round < 2; round++) {
    for (const seat of order) {
      holeCards.get(seat)!.push(draft.deck[draft.dealtCount++]!);
    }
  }
  for (const [seat, cards] of holeCards) {
    patchSeat(draft, seat, { holeCards: [cards[0]!, cards[1]!] });
  }
  draft.events.push({ type: 'hole-cards-dealt', seats: order });

  refreshPots(draft);
  openBettingRound(draft, order[2] ?? order[0]!);
}

function dealNextStreet(draft: Draft): void {
  const nextStreet = STREETS[STREETS.indexOf(draft.street) + 1];
  if (!nextStreet) throw new IllegalActionError('board-complete');

  const count = STREET_CARD_COUNT[nextStreet];
  const dealt: Card[] = [];
  for (let i = 0; i < count; i++) dealt.push(draft.deck[draft.dealtCount++]!);

  draft.street = nextStreet;
  draft.board = [...draft.board, ...dealt];
  draft.events.push({ type: 'street-dealt', street: nextStreet, cards: dealt });

  for (const seat of draft.seats) {
    patchSeat(draft, seat.index, { streetCommitted: 0, hasActed: false, facedBet: null });
  }
  draft.currentBet = 0;
  draft.lastRaiseSize = draft.config.bigBlind;

  openBettingRound(draft, orderFromButton(draft)[0]!);
}

/**
 * Start a Street's betting, or skip straight past it when there is nothing left
 * to decide — which is what happens once everyone still in the Hand is all-in.
 */
function openBettingRound(draft: Draft, firstSeat: number): void {
  if (liveSeats(draft).length <= 1) return closeBettingRound(draft);

  const actor = findNextActor(draft, firstSeat);
  if (actor === null) return closeBettingRound(draft);
  setActor(draft, actor);
}

/**
 * The next Seat that owes an action, searching clockwise from `from` inclusive.
 *
 * A Seat owes an action when it can still act and has not acted since the last
 * aggression. The one exception: if it is the only Seat that can act and it has
 * nothing left to match, there is nobody for it to bet at, so the Street is over.
 */
function findNextActor(draft: Draft, from: number): number | null {
  const n = draft.config.seatCount;
  const soloActor = actionableSeats(draft).length <= 1;

  for (let i = 0; i < n; i++) {
    const index = (from + i) % n;
    const seat = seatAt(draft, index);
    if (!canStillAct(seat)) continue;
    if (seat.hasActed && seat.streetCommitted >= draft.currentBet) continue;
    if (soloActor && seat.streetCommitted >= draft.currentBet) continue;
    return index;
  }
  return null;
}

function closeBettingRound(draft: Draft): void {
  clearActor(draft);

  const uncalled = uncalledStreetExcess(draft.seats);
  if (uncalled) {
    const seat = seatAt(draft, uncalled.seat);
    patchSeat(draft, uncalled.seat, {
      stack: seat.stack + uncalled.amount,
      committed: seat.committed - uncalled.amount,
      streetCommitted: seat.streetCommitted - uncalled.amount,
    });
    draft.events.push({ type: 'uncalled-returned', seat: uncalled.seat, amount: uncalled.amount });
  }
  refreshPots(draft);

  // Everyone folded: the Hand is over now, and no more community cards are dealt.
  if (liveSeats(draft).length <= 1) {
    draft.phase = 'awaiting-showdown';
    return;
  }

  if (draft.street === 'river') {
    draft.phase = 'awaiting-showdown';
    return;
  }

  draft.phase = 'awaiting-deal';

  // Nobody can act again, so the rest of the board is a formality. Turn the cards
  // face up before it runs out; the UI paces the cards one at a time from here.
  if (actionableSeats(draft).length <= 1 && draft.revealedSeats.length === 0) {
    const showing = liveSeats(draft).map((seat) => seat.index);
    draft.revealedSeats = showing;
    draft.events.push({ type: 'all-in-runout', seats: showing });
  }
}

// ---------------------------------------------------------------------------
// Settlement
// ---------------------------------------------------------------------------

function settleHand(draft: Draft): void {
  clearActor(draft);

  // Belt and braces: no band of chips may exist that no live Seat can win.
  for (const excess of excessOverLiveCommitment(draft.seats)) {
    const seat = seatAt(draft, excess.seat);
    patchSeat(draft, excess.seat, {
      stack: seat.stack + excess.amount,
      committed: seat.committed - excess.amount,
      streetCommitted: Math.max(0, seat.streetCommitted - excess.amount),
    });
    draft.events.push({ type: 'uncalled-returned', seat: excess.seat, amount: excess.amount });
  }

  const contested = liveSeats(draft);
  if (contested.length > 1) {
    const showing = contested.map((seat) => seat.index);
    draft.revealedSeats = showing;
    draft.events.push({ type: 'showdown', seats: showing });
  }

  const pots = buildPots(draft.seats);
  const awards = awardPots(pots, draft.seats, draft.board, orderFromButton(draft));

  for (const award of awards) {
    for (const winner of award.winners) {
      patchSeat(draft, winner.seat, { stack: seatAt(draft, winner.seat).stack + winner.amount });
    }
    draft.events.push({
      type: 'pot-awarded',
      potIndex: award.potIndex,
      amount: award.amount,
      winners: award.winners,
      oddChipSeat: award.oddChipSeat,
    });
  }

  for (const seat of draft.seats) {
    patchSeat(draft, seat.index, { committed: 0, streetCommitted: 0 });
  }
  draft.pots = [];

  // Reveal: every Seat's hole cards, including everyone who folded. This is the
  // learning tool, and it only happens once the Hand is already settled, so it
  // cannot influence a decision.
  draft.revealedSeats = draft.seats.map((seat) => seat.index);
  draft.phase = 'hand-complete';
  draft.events.push({ type: 'hand-complete', handNumber: draft.handNumber });
}

function finishHand(draft: Draft): void {
  const { startingStack, seatCount, handsPerSession } = draft.config;

  // Rebuy. The Stack is credited and the Score is debited by exactly the same
  // amount, which is why the six Scores still sum to zero afterwards (ADR-0002).
  // Nobody ever leaves the table, so nobody spends twenty hands watching.
  for (const seat of draft.seats) {
    if (seat.stack > 0) continue;
    patchSeat(draft, seat.index, {
      stack: seat.stack + startingStack,
      boughtIn: seat.boughtIn + startingStack,
    });
    draft.events.push({ type: 'rebuy', seat: seat.index, amount: startingStack });
  }

  draft.buttonSeat = (draft.buttonSeat + 1) % seatCount;

  if (draft.handNumber >= handsPerSession) {
    draft.phase = 'session-complete';
    draft.events.push({ type: 'session-complete' });
    return;
  }
  draft.phase = 'awaiting-hand';
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

function applyPlayerAction(draft: Draft, action: PlayerAction): void {
  if (draft.phase !== 'awaiting-action' || draft.actorSeat === null || !draft.legalActions) {
    throw new IllegalActionError('not-awaiting-action', `phase is ${draft.phase}`);
  }

  const index = draft.actorSeat;
  const legal = draft.legalActions;
  const before = seatAt(draft, index);

  switch (action.type) {
    case 'fold': {
      patchSeat(draft, index, { folded: true, hasActed: true, facedBet: draft.currentBet });
      draft.events.push({
        type: 'acted',
        seat: index,
        action: 'fold',
        paid: 0,
        totalThisStreet: before.streetCommitted,
        allIn: false,
      });
      break;
    }
    case 'check': {
      if (!legal.canCheck) throw new IllegalActionError('cannot-check');
      patchSeat(draft, index, { hasActed: true, facedBet: draft.currentBet });
      draft.events.push({
        type: 'acted',
        seat: index,
        action: 'check',
        paid: 0,
        totalThisStreet: before.streetCommitted,
        allIn: false,
      });
      break;
    }
    case 'call': {
      if (!legal.canCall) throw new IllegalActionError('cannot-call');
      const paid = payChips(draft, index, legal.callAmount);
      patchSeat(draft, index, { hasActed: true, facedBet: draft.currentBet });
      draft.events.push({
        type: 'acted',
        seat: index,
        action: 'call',
        paid,
        totalThisStreet: seatAt(draft, index).streetCommitted,
        allIn: seatAt(draft, index).stack === 0,
      });
      break;
    }
    case 'bet':
    case 'raise': {
      applyAggression(draft, index, action.to, action.type);
      break;
    }
    case 'all-in': {
      if (!legal.canAllIn) throw new IllegalActionError('cannot-all-in');
      const to = before.streetCommitted + before.stack;
      if (to <= draft.currentBet) {
        // Short of the current bet: this is a call for everything left.
        const paid = payChips(draft, index, before.stack);
        patchSeat(draft, index, { hasActed: true, facedBet: draft.currentBet });
        draft.events.push({
          type: 'acted',
          seat: index,
          action: 'all-in',
          paid,
          totalThisStreet: seatAt(draft, index).streetCommitted,
          allIn: true,
        });
      } else {
        applyAggression(draft, index, to, 'all-in');
      }
      break;
    }
  }

  refreshPots(draft);

  const next = findNextActor(draft, (index + 1) % draft.config.seatCount);
  if (next === null) closeBettingRound(draft);
  else setActor(draft, next);
}

/**
 * Apply a bet, a raise, or an all-in that lifts the bet.
 *
 * The interesting case is an all-in too small to be a full raise. It still has to
 * be matched, so everyone gets to act again — but it does not reopen the right to
 * re-raise for Seats that had already called the previous amount.
 */
function applyAggression(
  draft: Draft,
  index: number,
  to: number,
  kind: 'bet' | 'raise' | 'all-in',
): void {
  const legal = draft.legalActions!;
  const seat = seatAt(draft, index);
  const isShove = to === legal.maxRaiseTo;

  if (kind === 'bet' && draft.currentBet !== 0) throw new IllegalActionError('bet-requires-no-bet');
  if (kind === 'raise' && draft.currentBet === 0) throw new IllegalActionError('raise-requires-bet');
  if (kind === 'all-in' && !isShove) throw new IllegalActionError('all-in-must-be-full-stack');
  if (to <= draft.currentBet) throw new IllegalActionError('raise-too-small');
  if (to > legal.maxRaiseTo) throw new IllegalActionError('raise-exceeds-stack');
  // A Seat facing an all-in raise too small to be a full raise may match it or
  // fold, but the betting was not reopened for it — not even by shoving.
  if (!bettingIsOpenFor(seat, draft.currentBet, Math.max(draft.lastRaiseSize, draft.config.bigBlind))) {
    throw new IllegalActionError('betting-not-reopened');
  }
  if (!draft.seats.some((other) => other.index !== index && canStillAct(other))) {
    throw new IllegalActionError('no-one-left-to-call');
  }
  // Below the minimum is only ever allowed as a shove: the right to push is never
  // taken away, but a partial raise for less is not a thing.
  if (to < legal.minRaiseTo && !isShove) throw new IllegalActionError('below-min-raise');

  const raiseSize = to - draft.currentBet;
  const isFullRaise = raiseSize >= Math.max(draft.lastRaiseSize, draft.config.bigBlind);

  const paid = payChips(draft, index, to - seat.streetCommitted);
  // The raiser has now "faced" its own bet, so only a full raise over the top
  // gives it the right to raise again.
  patchSeat(draft, index, { hasActed: true, facedBet: to });

  draft.currentBet = to;
  if (isFullRaise) draft.lastRaiseSize = raiseSize;

  // Everyone still able to act owes an action again, even against an under-sized
  // all-in: they have to match it or fold. Whether they may *raise* is a
  // separate question, answered by `bettingIsOpenFor` from what they last faced.
  for (const other of draft.seats) {
    if (other.index === index || !canStillAct(other)) continue;
    patchSeat(draft, other.index, { hasActed: false });
  }

  draft.events.push({
    type: 'acted',
    seat: index,
    action: kind,
    paid,
    totalThisStreet: seatAt(draft, index).streetCommitted,
    allIn: seatAt(draft, index).stack === 0,
  });
}
