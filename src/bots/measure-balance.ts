// How the five personalities actually do against each other.
//
// One definition of the experiment, used by both consumers: the regression guard
// in `balance.slow.test.ts` and the tuning readout in
// `scripts/measure-bot-balance.ts`. They used to carry a copy each, which is a
// bad idea for a measurement — change the rotation in one and the guard would be
// defending a different experiment than the tool reports.
//
// Impressions about poker strategies are unreliable: per-Hand variance dwarfs the
// edge between two styles, so a handful of Sessions tells you nothing. Hence a
// lot of Sessions, the line-up rotated so no result is a seat or position
// artefact, and a standard error next to every number.

import { createSession, reduce } from '../engine/engine.ts';
import { scoreOf, type SessionState } from '../engine/types.ts';
import { computeEquity } from '../poker-math/equity.ts';
import { seededRng } from '../poker-math/rng.ts';
import { decideWithEquity } from './decide.ts';
import { PERSONALITIES, PERSONALITY_KEYS } from './personalities.ts';
import type { PersonalityKey } from './types.ts';
import { makeBotView } from './view.ts';

export type BalanceResult = {
  readonly key: PersonalityKey;
  /** Net chips won per Hand. Negative means this style is paying for the table. */
  readonly perHand: number;
  readonly stderr: number;
  readonly hands: number;
  readonly total: number;
};

export type BalanceOptions = {
  readonly sessions?: number;
  /**
   * Equity iterations per decision. Lower than the game uses on purpose: the Bots
   * add their own noise on top, so precision here buys nothing but runtime.
   */
  readonly iterations?: number;
};

export function measureBalance(options: BalanceOptions = {}): BalanceResult[] {
  const sessions = options.sessions ?? 300;
  const iterations = options.iterations ?? 400;

  const tally = new Map(
    PERSONALITY_KEYS.map((key) => [key, { chips: 0, hands: 0, sumSq: 0 }]),
  );

  for (let s = 0; s < sessions; s++) {
    const rng = seededRng(s * 7919 + 17);
    let state: SessionState = createSession({ seed: s, playerSeat: 0 });
    const n = state.config.seatCount;

    // Rotate by Session index, so every personality sees every Seat and every
    // position equally often.
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
            const delta = scoreOf(seat) - before.get(seat.index)!;
            t.chips += delta;
            t.sumSq += delta * delta;
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
        iterations,
      });
      state = reduce(state, decideWithEquity(view, PERSONALITIES[seating.get(seat)!], equity, rng));
    }
  }

  return [...tally]
    .map(([key, t]) => {
      const perHand = t.chips / t.hands;
      const variance = t.sumSq / t.hands - perHand * perHand;
      return {
        key,
        perHand,
        stderr: Math.sqrt(variance / t.hands),
        hands: t.hands,
        total: t.chips,
      };
    })
    .sort((a, b) => b.perHand - a.perHand);
}
