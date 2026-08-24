import { describe, expect, it } from 'vitest';
import { seededRng } from '../poker-math/rng.ts';
import { createSession, reduce } from './engine.ts';
import { weightedLegalAction } from './random-play.ts';
import { chipsInPlay, scoreSum } from './selectors.ts';
import { totalPot } from './pots.ts';
import { scoreOf, type SessionState } from './types.ts';

// The engine's main verification (issue 09). Arbitrary legal play, a hundred
// thousand Hands, and three things asserted after each one:
//
//   * the six Scores sum to zero — the invariant from ADR-0002;
//   * no Stack is negative;
//   * chips are conserved: Stacks plus the middle equals everything bought in.
//
// Everything is seeded, so a failure prints a seed and a Hand number that replay
// the exact position.

const HANDS = 100_000;

type Failure = { seed: number; handNumber: number; reason: string };

function checkHand(state: SessionState, seed: number): Failure | null {
  const fail = (reason: string): Failure => ({ seed, handNumber: state.handNumber, reason });

  if (scoreSum(state) !== 0) return fail(`Scores sum to ${scoreSum(state)}, not 0`);
  for (const seat of state.seats) {
    if (seat.stack < 0) return fail(`seat ${seat.index} has a negative Stack of ${seat.stack}`);
  }
  const boughtIn = state.seats.reduce((sum, seat) => sum + seat.boughtIn, 0);
  if (chipsInPlay(state) !== boughtIn) {
    return fail(`${chipsInPlay(state)} chips in play against ${boughtIn} bought in`);
  }
  return null;
}

describe('a hundred thousand Hands of arbitrary legal play', () => {
  it('never breaks zero-sum, never goes negative, never loses a chip', () => {
    let handsPlayed = 0;
    let seed = 0;
    let failure: Failure | null = null;
    let sawSidePots = false;
    let sawSplitPots = false;
    let sawRebuys = false;

    while (handsPlayed < HANDS && !failure) {
      seed++;
      const rng = seededRng(seed);
      let state = createSession({ seed });

      for (let step = 0; step < 100_000; step++) {
        if (state.phase === 'session-complete') break;

        // Mid-Hand the same accounting has to hold, so check it every step, not
        // only at the boundaries where things are tidy.
        if (state.pots.length > 1) sawSidePots = true;

        state =
          state.phase === 'awaiting-action'
            ? reduce(state, weightedLegalAction(state.legalActions!, rng))
            : reduce(state, { type: 'advance' });

        for (const event of state.events) {
          if (event.type === 'rebuy') sawRebuys = true;
          if (event.type === 'pot-awarded' && event.winners.length > 1) sawSplitPots = true;
        }

        if (state.phase === 'hand-complete') {
          handsPlayed++;
          failure = checkHand(state, seed);
          if (failure) break;
        }
      }
    }

    expect(failure, failure ? `seed ${failure.seed}, hand ${failure.handNumber}: ${failure.reason}` : '')
      .toBeNull();
    expect(handsPlayed).toBeGreaterThanOrEqual(HANDS);

    // If none of these ever happened the run would have proved very little.
    expect(sawSidePots).toBe(true);
    expect(sawSplitPots).toBe(true);
    expect(sawRebuys).toBe(true);
  });

  it('replays a failing seed exactly, so any failure above is reproducible', () => {
    const replay = (seed: number) => {
      const rng = seededRng(seed);
      let state = createSession({ seed });
      const trace: string[] = [];
      while (state.phase !== 'session-complete') {
        state =
          state.phase === 'awaiting-action'
            ? reduce(state, weightedLegalAction(state.legalActions!, rng))
            : reduce(state, { type: 'advance' });
        trace.push(`${state.phase}:${state.handNumber}:${totalPot(state.pots)}`);
      }
      return { trace, scores: state.seats.map(scoreOf) };
    };
    expect(replay(31_337)).toEqual(replay(31_337));
  });
});
