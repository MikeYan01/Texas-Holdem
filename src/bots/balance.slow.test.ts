import { describe, expect, it } from 'vitest';
import { createSession, reduce } from '../engine/engine.ts';
import { scoreOf, type SessionState } from '../engine/types.ts';
import { computeEquity } from '../poker-math/equity.ts';
import { seededRng } from '../poker-math/rng.ts';
import { decideWithEquity } from './decide.ts';
import { PERSONALITIES, PERSONALITY_KEYS } from './personalities.ts';
import type { PersonalityKey } from './types.ts';
import { makeBotView } from './view.ts';

// No personality may be a cash machine for the others.
//
// This exists because one was. The original Maniac demanded 4% equity where the
// pot odds were 20%, so every call it made lost money by construction; it shipped
// 5 BB a hand to the rest of the table and turned four losing styles into
// winners. Nothing in the unit tests noticed, because they check the *ordering*
// of the personalities — deliberately, so tuning is not locked down — and the
// ordering was perfectly correct while the table was broken.
//
// So the bound here is loose on purpose. It does not pin the balance; it only
// asserts that nobody is playing a strategy that cannot win.

const SESSIONS = 300;
const ITERATIONS = 400; // the Bots add their own noise; precision is wasted here
/** Chips per Hand. The Bot that broke this was at -10.2; the worst is now ~-1.4. */
const WORST_ALLOWED = -4;

type Tally = { chips: number; hands: number };

function measure(): Map<PersonalityKey, Tally> {
  const tally = new Map<PersonalityKey, Tally>(
    PERSONALITY_KEYS.map((key) => [key, { chips: 0, hands: 0 }]),
  );

  for (let s = 0; s < SESSIONS; s++) {
    const rng = seededRng(s * 7919 + 17);
    let state: SessionState = createSession({ seed: s, playerSeat: 0 });
    const n = state.config.seatCount;

    // Rotate the line-up by Session, so every personality sees every Seat and
    // every position equally often and no result is a seat artefact.
    const seating = new Map<number, PersonalityKey>(
      Array.from({ length: n }, (_, seat) => [
        seat,
        PERSONALITY_KEYS[(seat + s) % PERSONALITY_KEYS.length]!,
      ]),
    );
    const before = new Map(state.seats.map((seat) => [seat.index, scoreOf(seat)]));

    for (let step = 0; step < 100_000 && state.phase !== 'session-complete'; step++) {
      if (state.phase !== 'awaiting-action') {
        state = reduce(state, { type: 'advance' });
        if (state.phase === 'hand-complete') {
          for (const seat of state.seats) {
            const t = tally.get(seating.get(seat.index)!)!;
            t.chips += scoreOf(seat) - before.get(seat.index)!;
            t.hands += 1;
            before.set(seat.index, scoreOf(seat));
          }
        }
        continue;
      }
      const seat = state.actorSeat!;
      const view = makeBotView(state, seat);
      const { equity } = computeEquity({
        hole: view.holeCards,
        board: view.board,
        opponentCount: view.opponentCount,
        rng,
        iterations: ITERATIONS,
      });
      state = reduce(state, decideWithEquity(view, PERSONALITIES[seating.get(seat)!], equity, rng));
    }
  }
  return tally;
}

describe('the table is a game, not a donation', () => {
  const tally = measure();
  const perHand = (key: PersonalityKey) => {
    const t = tally.get(key)!;
    return t.chips / t.hands;
  };

  it('observed a meaningful number of Hands for every personality', () => {
    for (const key of PERSONALITY_KEYS) {
      expect(tally.get(key)!.hands, key).toBeGreaterThan(2000);
    }
  });

  it('has nobody haemorrhaging chips to everybody else', () => {
    for (const key of PERSONALITY_KEYS) {
      expect(perHand(key), `${key} loses ${perHand(key).toFixed(2)} chips per Hand`).toBeGreaterThan(
        WORST_ALLOWED,
      );
    }
  });

  it('keeps the whole field within a couple of big blinds of each other', () => {
    const results = PERSONALITY_KEYS.map(perHand);
    const spread = Math.max(...results) - Math.min(...results);
    expect(spread, `spread is ${spread.toFixed(2)} chips per Hand`).toBeLessThan(8);
  });

  it('still adds up to zero, whatever the styles do to each other', () => {
    const total = PERSONALITY_KEYS.reduce((sum, key) => sum + tally.get(key)!.chips, 0);
    expect(Math.abs(total)).toBeLessThan(1e-6);
  });
});
