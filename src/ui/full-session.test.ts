import { describe, expect, it } from 'vitest';
import { seededRng } from '../poker-math/rng.ts';
import { getEquity } from '../poker-math/equity.ts';
import { createSession, reduce } from '../engine/engine.ts';
import { chipsInPlay, scoreSum, visibleHoleCards } from '../engine/selectors.ts';
import { enumerateLegalActions } from '../engine/random-play.ts';
import { DEFAULT_CONFIG, scoreOf, type SessionState } from '../engine/types.ts';
import { decide } from '../bots/decide.ts';
import { PERSONALITIES } from '../bots/personalities.ts';
import { assignPersonalities, makeBotView } from '../bots/view.ts';
import { describeEvent } from './text/events.ts';
import { LOCALES } from './text/locale.ts';

// The whole game, with real Bots and real Equity, minus React and minus the
// clock. Everything the UI adds on top of this is timers and markup: if a whole
// Session plays out here without an illegal action, a stuck state or a broken
// invariant, the table is playable.

const HANDS = DEFAULT_CONFIG.handsPerSession;
const ORBITS = HANDS / DEFAULT_CONFIG.seatCount;

async function playSession(seed: number) {
  const rng = seededRng(seed);
  let state: SessionState = createSession({ seed });
  const seating = assignPersonalities(state.config.seatCount, state.playerSeat, seededRng(seed));

  const stats = {
    hands: 0,
    decisions: 0,
    lines: 0,
    sawSidePot: false,
    sawShowdown: false,
    sawRebuy: false,
    playerEquityReadings: 0,
  };

  for (let step = 0; step < 100_000; step++) {
    if (state.phase === 'session-complete') break;

    if (state.phase !== 'awaiting-action') {
      state = reduce(state, { type: 'advance' });
    } else {
      const seat = state.actorSeat!;
      const legal = state.legalActions!;

      if (seat === state.playerSeat) {
        // Stand in for the human, using the same Equity readout they would see.
        const hole = state.seats[seat]!.holeCards!;
        const { equity } = await getEquity({
          hole,
          board: state.board,
          opponentCount: state.seats.filter((s) => !s.folded && s.index !== seat).length,
          rng,
        });
        expect(equity).toBeGreaterThanOrEqual(0);
        expect(equity).toBeLessThanOrEqual(1);
        stats.playerEquityReadings++;
        state = reduce(state, legal.canCheck ? { type: 'check' } : { type: 'call' });
      } else {
        const key = seating.get(seat)!;
        const action = await decide(makeBotView(state, seat), PERSONALITIES[key], {
          equity: async (request) => (await getEquity(request)).equity,
          rng,
        });
        expect(enumerateLegalActions(legal).map((a) => a.type)).toContain(action.type);
        state = reduce(state, action);
        stats.decisions++;
      }
    }

    if (state.pots.length > 1) stats.sawSidePot = true;
    for (const event of state.events) {
      if (event.type === 'showdown') stats.sawShowdown = true;
      if (event.type === 'rebuy') stats.sawRebuy = true;
      // Every event the engine emits has to be renderable in every language the
      // interface offers — a missing translation is a blank line on the felt.
      for (const locale of LOCALES) {
        const line = describeEvent(
          event,
          (s) => (s === state.playerSeat ? 'you' : `seat${s}`),
          locale,
          state.playerSeat,
        );
        if (!line) continue;
        if (locale === LOCALES[0]) stats.lines++;
        expect(line.text, `${event.type} in ${locale}`).not.toContain('undefined');
        expect(line.text, `${event.type} in ${locale}`).not.toContain('NaN');
        expect(line.text.trim(), `${event.type} in ${locale}`).not.toBe('');
      }
    }

    // Mid-Hand, no Bot's cards may be visible unless they were turned face up.
    if (state.phase !== 'hand-complete') {
      for (const seat of state.seats) {
        if (seat.index === state.playerSeat || state.revealedSeats.includes(seat.index)) continue;
        expect(visibleHoleCards(state, seat.index)).toBeNull();
      }
    }

    if (state.phase === 'hand-complete') {
      stats.hands++;
      expect(scoreSum(state)).toBe(0);
      expect(chipsInPlay(state)).toBe(state.seats.reduce((sum, s) => sum + s.boughtIn, 0));
      for (const seat of state.seats) expect(seat.stack).toBeGreaterThanOrEqual(0);
    }
  }

  return { state, stats };
}

describe('a whole Session, played by the real Bots', () => {
  it('runs a whole Session to a ranking without getting stuck', async () => {
    const { state, stats } = await playSession(20_260_824);

    expect(state.phase).toBe('session-complete');
    expect(stats.hands).toBe(HANDS);
    expect(state.handNumber).toBe(HANDS);
    expect(state.orbit).toBe(ORBITS);
    expect(stats.decisions).toBeGreaterThan(100);
    expect(stats.lines).toBeGreaterThan(200);
    expect(stats.playerEquityReadings).toBeGreaterThan(20);
    expect(stats.sawShowdown).toBe(true);
    expect(scoreSum(state)).toBe(0);
  }, 120_000);

  it('produces a ranking where somebody is ahead and somebody is behind', async () => {
    const { state } = await playSession(7);
    const scores = state.seats.map(scoreOf);
    expect(Math.max(...scores)).toBeGreaterThan(0);
    expect(Math.min(...scores)).toBeLessThan(0);
    expect(scores.reduce((a, b) => a + b, 0)).toBe(0);
  }, 120_000);

  it('reveals every Seat once the Hand is settled, folders included', async () => {
    let state: SessionState = createSession({ seed: 99 });
    const rng = seededRng(99);
    const seating = assignPersonalities(6, state.playerSeat, seededRng(99));

    while (state.phase !== 'hand-complete') {
      if (state.phase !== 'awaiting-action') {
        state = reduce(state, { type: 'advance' });
        continue;
      }
      const seat = state.actorSeat!;
      if (seat === state.playerSeat) {
        state = reduce(state, state.legalActions!.canCheck ? { type: 'check' } : { type: 'call' });
      } else {
        const action = await decide(makeBotView(state, seat), PERSONALITIES[seating.get(seat)!], {
          equity: async (request) => (await getEquity(request)).equity,
          rng,
        });
        state = reduce(state, action);
      }
    }

    expect(state.revealedSeats).toHaveLength(6);
    for (const seat of state.seats) {
      expect(visibleHoleCards(state, seat.index), `seat ${seat.index}`).not.toBeNull();
    }
    // Somebody folded along the way, and their cards are face up too.
    expect(state.seats.some((seat) => seat.folded)).toBe(true);
  }, 60_000);
});
