// Measure how the five personalities actually do against each other.
//
// Run with: node scripts/measure-bot-balance.ts [sessions]
//
// Impressions about poker strategies are unreliable — per-Hand variance is far
// larger than the edge between two styles, so a few Sessions tell you nothing.
// This plays a lot of them, rotates which Seat holds which personality so seat
// and Button order cannot bias the result, and reports chips won per Hand with a
// standard error next to it.

import { createSession, reduce } from '../src/engine/engine.ts';
import { scoreOf, type SessionState } from '../src/engine/types.ts';
import { decideWithEquity } from '../src/bots/decide.ts';
import { PERSONALITIES, PERSONALITY_KEYS } from '../src/bots/personalities.ts';
import { makeBotView } from '../src/bots/view.ts';
import type { PersonalityKey } from '../src/bots/types.ts';
import { computeEquity } from '../src/poker-math/equity.ts';
import { seededRng } from '../src/poker-math/rng.ts';

const sessions = Number(process.argv[2] ?? 300);
// Fewer iterations than the game uses: the Bots add their own noise on top
// anyway, and this needs to run in a coffee break rather than an afternoon.
const ITERATIONS = 400;

type Tally = { chips: number; hands: number; sumSq: number };
const tally = new Map<PersonalityKey, Tally>(
  PERSONALITY_KEYS.map((key) => [key, { chips: 0, hands: 0, sumSq: 0 }]),
);

const started = Date.now();

for (let s = 0; s < sessions; s++) {
  const rng = seededRng(s * 7919 + 17);
  let state: SessionState = createSession({ seed: s, playerSeat: 0 });
  const n = state.config.seatCount;

  // Rotate the line-up by the Session index so every personality sees every Seat
  // and every position equally often.
  const seating = new Map<number, PersonalityKey>(
    Array.from({ length: n }, (_, seat) => [
      seat,
      PERSONALITY_KEYS[(seat + s) % PERSONALITY_KEYS.length]!,
    ]),
  );

  const scoreBefore = new Map<number, number>(state.seats.map((seat) => [seat.index, scoreOf(seat)]));

  for (let step = 0; step < 100_000 && state.phase !== 'session-complete'; step++) {
    if (state.phase !== 'awaiting-action') {
      state = reduce(state, { type: 'advance' });
      if (state.phase === 'hand-complete') {
        for (const seat of state.seats) {
          const key = seating.get(seat.index)!;
          const t = tally.get(key)!;
          const delta = scoreOf(seat) - scoreBefore.get(seat.index)!;
          t.chips += delta;
          t.sumSq += delta * delta;
          t.hands += 1;
          scoreBefore.set(seat.index, scoreOf(seat));
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

const rows = [...tally].map(([key, t]) => {
  const perHand = t.chips / t.hands;
  const variance = t.sumSq / t.hands - perHand * perHand;
  return { key, perHand, stderr: Math.sqrt(variance / t.hands), hands: t.hands, total: t.chips };
});
rows.sort((a, b) => b.perHand - a.perHand);

const bb = 2;
console.log(`\n${sessions} sessions, ${rows[0]!.hands} hands observed per personality`);
console.log(`(${((Date.now() - started) / 1000).toFixed(0)}s)\n`);
console.log('personality        chips/hand      BB/hand    +/- 1se     total');
for (const r of rows) {
  console.log(
    r.key.padEnd(16),
    r.perHand.toFixed(2).padStart(10),
    (r.perHand / bb).toFixed(3).padStart(12),
    r.stderr.toFixed(2).padStart(10),
    String(Math.round(r.total)).padStart(10),
  );
}
const sum = rows.reduce((a, r) => a + r.total, 0);
console.log(`\nsum of all totals: ${Math.round(sum)} (must be 0 — it is a zero-sum game)`);
