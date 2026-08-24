import { describe, expect, it } from 'vitest';
import { formatCards } from '../poker-math/cards.ts';
import { createSession, reduce } from './engine.ts';
import { chipsInPlay, scoreSum, visibleHoleCards } from './selectors.ts';
import { positionAt } from './test-fixtures.ts';
import {
  DEFAULT_CONFIG,
  IllegalActionError,
  type PlayerAction,
  type SessionState,
} from './types.ts';

const STACK = DEFAULT_CONFIG.startingStack;

const advance = (state: SessionState) => reduce(state, { type: 'advance' });

/** Drive a Hand to settlement, letting every Seat take the given action. */
function playHand(start: SessionState, choose: (state: SessionState) => PlayerAction): SessionState {
  let state = start;
  for (let step = 0; step < 500; step++) {
    if (state.phase === 'hand-complete' || state.phase === 'session-complete') return state;
    state =
      state.phase === 'awaiting-action' ? reduce(state, choose(state)) : reduce(state, { type: 'advance' });
  }
  throw new Error('hand did not finish');
}

const callOrCheck = (state: SessionState): PlayerAction =>
  state.legalActions?.canCheck ? { type: 'check' } : { type: 'call' };

describe('createSession', () => {
  it('seats everyone with an equal Stack and a Score of zero', () => {
    const state = createSession({ seed: 1 });
    expect(state.seats).toHaveLength(6);
    for (const seat of state.seats) {
      expect(seat.stack).toBe(STACK);
      expect(seat.boughtIn).toBe(STACK);
    }
    expect(scoreSum(state)).toBe(0);
  });

  it('waits for the first Hand rather than dealing one', () => {
    const state = createSession({ seed: 1 });
    expect(state.phase).toBe('awaiting-hand');
    expect(state.handNumber).toBe(0);
    expect(state.board).toEqual([]);
    for (const seat of state.seats) expect(seat.holeCards).toBeNull();
  });

  it('is a pure function of its seed', () => {
    expect(createSession({ seed: 42 })).toEqual(createSession({ seed: 42 }));
  });

  it('seats the Player somewhere different for different seeds', () => {
    const placements = new Set(
      Array.from({ length: 60 }, (_, seed) => createSession({ seed }).playerSeat),
    );
    expect(placements.size).toBeGreaterThan(1);
  });
});

describe('dealing a Hand', () => {
  it('gives every Seat two hole cards from one shuffled deck', () => {
    const state = advance(createSession({ seed: 7 }));
    const dealt = state.seats.flatMap((seat) => seat.holeCards ?? []);
    expect(dealt).toHaveLength(12);
    expect(new Set(dealt).size).toBe(12);
    expect(state.dealtCount).toBe(12);
  });

  it('replays the same deck from the same seed', () => {
    const first = advance(createSession({ seed: 2026 }));
    const second = advance(createSession({ seed: 2026 }));
    expect(formatCards(first.deck)).toBe(formatCards(second.deck));
    expect(first.seats.map((s) => s.holeCards)).toEqual(second.seats.map((s) => s.holeCards));
  });

  it('deals a different deck from a different seed', () => {
    const a = advance(createSession({ seed: 1 }));
    const b = advance(createSession({ seed: 2 }));
    expect(formatCards(a.deck)).not.toBe(formatCards(b.deck));
  });

  it('leaves reduce pure: the same state and action always give the same result', () => {
    const state = createSession({ seed: 11 });
    expect(advance(state)).toEqual(advance(state));
    expect(state.phase).toBe('awaiting-hand'); // and the input is untouched
  });

  it('runs the board out three, one and one', () => {
    let state = advance(createSession({ seed: 3 }));
    const sizes: number[] = [];
    for (let i = 0; i < 400 && state.phase !== 'hand-complete'; i++) {
      state =
        state.phase === 'awaiting-action' ? reduce(state, callOrCheck(state)) : advance(state);
      const dealt = state.events.find((e) => e.type === 'street-dealt');
      if (dealt) sizes.push(dealt.cards.length);
    }
    expect(sizes).toEqual([3, 1, 1]);
    expect(state.board).toHaveLength(5);
  });

  it('walks preflop, flop, turn, river in order', () => {
    let state = advance(createSession({ seed: 5 }));
    const streets = [state.street];
    for (let i = 0; i < 400 && state.phase !== 'hand-complete'; i++) {
      state =
        state.phase === 'awaiting-action' ? reduce(state, callOrCheck(state)) : advance(state);
      if (state.street !== streets[streets.length - 1]) streets.push(state.street);
    }
    expect(streets).toEqual(['preflop', 'flop', 'turn', 'river']);
  });

  it('never puts a card in two places at once', () => {
    let state = advance(createSession({ seed: 8 }));
    state = playHand(state, callOrCheck);
    const seen = [...state.seats.flatMap((s) => s.holeCards ?? []), ...state.board];
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('emits structured events and not one word of prose', () => {
    const state = advance(createSession({ seed: 9 }));
    expect(state.events.map((e) => e.type)).toEqual([
      'hand-started',
      'blind-posted',
      'blind-posted',
      'hole-cards-dealt',
    ]);
    // Nothing in an event may be a user-facing string; the render layer writes
    // the Chinese from these shapes.
    const strings = JSON.stringify(state.events).match(/"[^"]*"/g) ?? [];
    for (const literal of strings) expect(literal).toMatch(/^"[a-zA-Z-]*"$/);
  });

  it('reports only the events of the step that produced the state', () => {
    let state = advance(createSession({ seed: 9 }));
    const first = state.events.length;
    state = reduce(state, callOrCheck(state));
    expect(state.events.map((e) => e.type)).toEqual(['acted']);
    expect(first).toBeGreaterThan(1);
  });
});

describe('showdown', () => {
  it('gives the pot to the best hand', () => {
    const state = positionAt({
      seats: [
        { stack: 100, hole: 'Ah Ad', committed: 50, streetCommitted: 50, hasActed: true },
        { stack: 100, hole: 'Kh Kd', committed: 50, streetCommitted: 50, hasActed: true },
        { stack: 100, hole: '7c 2d', folded: true, committed: 10 },
      ],
      board: '2h 5s 9c Jd 3s',
      street: 'river',
      phase: 'awaiting-showdown',
      actorSeat: null,
    });
    const settled = advance(state);
    expect(settled.seats[0]!.stack).toBe(210);
    expect(settled.seats[1]!.stack).toBe(100);
    expect(chipsInPlay(settled)).toBe(chipsInPlay(state));
  });

  it('splits an even pot between two equal hands', () => {
    const state = positionAt({
      seats: [
        { stack: 100, hole: 'Ah Kd', committed: 50, streetCommitted: 50, hasActed: true },
        { stack: 100, hole: 'As Kc', committed: 50, streetCommitted: 50, hasActed: true },
        { stack: 100, hole: '7c 2d', folded: true },
      ],
      board: '2h 5s 9c Jd 3s',
      street: 'river',
      phase: 'awaiting-showdown',
      actorSeat: null,
    });
    const settled = advance(state);
    expect(settled.seats[0]!.stack).toBe(150);
    expect(settled.seats[1]!.stack).toBe(150);
  });

  it('reports the winning hand as a value the render layer can describe', () => {
    const state = positionAt({
      seats: [
        { stack: 100, hole: 'Ah Ad', committed: 50, streetCommitted: 50, hasActed: true },
        { stack: 100, hole: 'Kh Kd', committed: 50, streetCommitted: 50, hasActed: true },
      ],
      board: '2h 5s 9c Jd 3s',
      street: 'river',
      phase: 'awaiting-showdown',
      actorSeat: null,
    });
    const award = advance(state).events.find((e) => e.type === 'pot-awarded');
    expect(award?.winners[0]?.handValue).toBeGreaterThan(0);
    expect(award?.winners[0]?.bestFive).toHaveLength(5);
  });
});

describe('hole card visibility', () => {
  it('shows the Player their own cards and nobody else theirs, mid-Hand', () => {
    const state = advance(createSession({ seed: 4 }));
    expect(visibleHoleCards(state, state.playerSeat)).not.toBeNull();
    for (const seat of state.seats) {
      if (seat.index === state.playerSeat) continue;
      expect(visibleHoleCards(state, seat.index)).toBeNull();
    }
  });

  it('keeps Bot cards hidden through every step of a Hand until it settles', () => {
    let state = advance(createSession({ seed: 6 }));
    for (let i = 0; i < 400 && state.phase !== 'hand-complete'; i++) {
      state =
        state.phase === 'awaiting-action' ? reduce(state, callOrCheck(state)) : advance(state);
      if (state.phase === 'hand-complete') break;
      for (const seat of state.seats) {
        if (seat.index === state.playerSeat || state.revealedSeats.includes(seat.index)) continue;
        expect(visibleHoleCards(state, seat.index)).toBeNull();
      }
    }
    // Reveal: once settled, every Seat is face up, folders included.
    for (const seat of state.seats) expect(visibleHoleCards(state, seat.index)).not.toBeNull();
  });
});

describe('the reducer refuses steps that make no sense', () => {
  it('will not advance while a Seat owes an action', () => {
    const state = advance(createSession({ seed: 12 }));
    expect(state.phase).toBe('awaiting-action');
    expect(() => advance(state)).toThrow(IllegalActionError);
  });

  it('will not take a player action between Hands', () => {
    const state = createSession({ seed: 12 });
    expect(() => reduce(state, { type: 'check' })).toThrow(IllegalActionError);
  });
});
