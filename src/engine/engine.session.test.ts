import { describe, expect, it } from 'vitest';
import { seededRng } from '../poker-math/rng.ts';
import { createSession, reduce } from './engine.ts';
import { weightedLegalAction } from './random-play.ts';
import { chipsInPlay, rankingByScore, scoreSum } from './selectors.ts';
import { positionAt } from './test-fixtures.ts';
import { IllegalActionError, scoreOf, type SessionState } from './types.ts';

const advance = (state: SessionState) => reduce(state, { type: 'advance' });

/** Play a whole Session with arbitrary legal play, seeded so it replays. */
function playSession(seed: number, onHandEnd?: (state: SessionState) => void): SessionState {
  const rng = seededRng(seed);
  let state = createSession({ seed });
  for (let step = 0; step < 200_000; step++) {
    if (state.phase === 'session-complete') return state;
    state =
      state.phase === 'awaiting-action'
        ? reduce(state, weightedLegalAction(state.legalActions!, rng))
        : advance(state);
    if (state.phase === 'hand-complete') onHandEnd?.(state);
  }
  throw new Error(`session ${seed} never finished`);
}

describe('a Session is five Orbits', () => {
  it('plays exactly thirty Hands and then stops', () => {
    let hands = 0;
    const final = playSession(101, () => hands++);
    expect(hands).toBe(30);
    expect(final.handNumber).toBe(30);
    expect(final.phase).toBe('session-complete');
  });

  it('refuses to go on afterwards', () => {
    const final = playSession(102);
    expect(() => advance(final)).toThrow(IllegalActionError);
  });

  it('counts Hands and Orbits so the table can always say where it is', () => {
    const seen: Array<[number, number]> = [];
    playSession(103, (state) => seen.push([state.handNumber, state.orbit]));
    expect(seen[0]).toEqual([1, 1]);
    expect(seen[5]).toEqual([6, 1]);
    expect(seen[6]).toEqual([7, 2]);
    expect(seen[29]).toEqual([30, 5]);
  });

  it('gives every Seat the Button once per Orbit', () => {
    const buttons: number[] = [];
    let state = createSession({ seed: 104 });
    for (let hand = 0; hand < 6; hand++) {
      state = advance(state);
      buttons.push(state.buttonSeat);
      while (state.phase !== 'hand-complete') {
        state = state.phase === 'awaiting-action' ? reduce(state, { type: 'fold' }) : advance(state);
      }
      state = advance(state);
    }
    expect(new Set(buttons).size).toBe(6);
  });

  it('does not end early just because somebody went broke', () => {
    let hands = 0;
    let sawARebuy = false;
    const final = playSession(105, (state) => {
      hands++;
      if (state.seats.some((seat) => seat.stack === 0)) sawARebuy = true;
    });
    expect(sawARebuy).toBe(true);
    expect(hands).toBe(30);
    expect(final.phase).toBe('session-complete');
  });
});

describe('Stack, Score and Rebuy', () => {
  it('keeps Stack and Score as separate numbers', () => {
    const state = positionAt({
      seats: [
        { stack: 40, boughtIn: 400 },
        { stack: 260, boughtIn: 200 },
        { stack: 300, boughtIn: 200 },
      ],
    });
    expect(scoreOf(state.seats[0]!)).toBe(-360);
    expect(scoreOf(state.seats[1]!)).toBe(60);
    expect(state.seats[0]!.stack).toBe(40); // what it can bet, not what it is worth
  });

  it('rebuys a broke Seat back to the starting Stack, debiting its Score', () => {
    const state = positionAt({
      seats: [{ stack: 0 }, { stack: 300 }, { stack: 300 }],
      phase: 'hand-complete',
      actorSeat: null,
    });
    expect(scoreOf(state.seats[0]!)).toBe(-200);

    const next = advance(state);
    expect(next.seats[0]!.stack).toBe(200);
    expect(next.seats[0]!.boughtIn).toBe(400);
    // The Stack is credited and the Score debited by the same amount, so the
    // Score does not move: what was lost stays lost.
    expect(scoreOf(next.seats[0]!)).toBe(-200);
    expect(next.events).toContainEqual({ type: 'rebuy', seat: 0, amount: 200 });
  });

  it('rebuys again and again, so nobody ever leaves the table', () => {
    let state = positionAt({
      seats: [{ stack: 0 }, { stack: 300 }, { stack: 300 }],
      phase: 'hand-complete',
      actorSeat: null,
    });
    for (let i = 0; i < 4; i++) {
      state = advance(state); // rebuy and move on
      expect(state.seats[0]!.stack).toBe(200);
      state = { ...state, phase: 'hand-complete', seats: [{ ...state.seats[0]!, stack: 0 }, ...state.seats.slice(1)] };
    }
    expect(state.seats[0]!.boughtIn).toBe(1000);
    expect(scoreOf(state.seats[0]!)).toBe(-1000);
  });

  it('ranks the Seats by Score for the results screen', () => {
    const state = positionAt({
      seats: [
        { stack: 100, boughtIn: 200 },
        { stack: 400, boughtIn: 200 },
        { stack: 300, boughtIn: 200 },
      ],
    });
    expect(rankingByScore(state).map((seat) => seat.index)).toEqual([1, 2, 0]);
  });
});

describe('the zero-sum invariant', () => {
  it('holds at the start', () => {
    expect(scoreSum(createSession({ seed: 1 }))).toBe(0);
  });

  it('holds after every single Hand of a Session', () => {
    playSession(106, (state) => {
      expect(scoreSum(state)).toBe(0);
      for (const seat of state.seats) expect(seat.stack).toBeGreaterThanOrEqual(0);
    });
  });

  it('holds across several Sessions with different seeds', () => {
    for (let seed = 200; seed < 210; seed++) {
      const final = playSession(seed);
      expect(scoreSum(final)).toBe(0);
      expect(chipsInPlay(final)).toBe(
        final.seats.reduce((sum, seat) => sum + seat.boughtIn, 0),
      );
    }
  });
});
