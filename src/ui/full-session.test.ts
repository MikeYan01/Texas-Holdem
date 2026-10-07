import { describe, expect, it } from 'vitest';
import { seededRng } from '../poker-math/rng.ts';
import { handOdds, likeliestCategories } from '../poker-math/hand-odds.ts';
import { createSession, reduce } from '../engine/engine.ts';
import { chipsInPlay, scoreSum, visibleHoleCards } from '../engine/selectors.ts';
import { enumerateLegalActions } from '../engine/random-play.ts';
import { DEFAULT_CONFIG, scoreOf, type SessionState } from '../engine/types.ts';
import { decide } from '../bots/decide.ts';
import { PERSONALITIES } from '../bots/personalities.ts';
import { assignPersonalities, makeBotView } from '../bots/view.ts';
import { equityProvider } from './equity.ts';
import { describeEvent } from './text/events.ts';
import { LOCALES } from './text/locale.ts';

// A Session integrates the engine, real Bot decisions, Hand Odds and localized events.
// React interactions and pacing are outside this test.

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
    sawShowdown: false,
    playerHandOddsReadings: 0,
  };

  for (let step = 0; step < 100_000; step++) {
    if (state.phase === 'session-complete') break;

    if (state.phase !== 'awaiting-action') {
      state = reduce(state, { type: 'advance' });
    } else {
      const seat = state.actorSeat!;
      const legal = state.legalActions!;

      if (seat === state.playerSeat) {
        // Read the Player's Hand Odds, then stand in with check/call.
        const hole = state.seats[seat]!.holeCards!;
        const odds = handOdds(hole, state.board);
        const top = likeliestCategories(odds, 5);
        expect(odds.probabilities.reduce((sum, chance) => sum + chance, 0)).toBeCloseTo(1, 12);
        expect(top.length).toBeGreaterThan(0);
        expect(top.length).toBeLessThanOrEqual(5);
        stats.playerHandOddsReadings++;
        state = reduce(state, legal.canCheck ? { type: 'check' } : { type: 'call' });
      } else {
        const key = seating.get(seat)!;
        const action = await decide(makeBotView(state, seat), PERSONALITIES[key], {
          equity: equityProvider,
          rng,
        });
        expect(enumerateLegalActions(legal).map((a) => a.type)).toContain(action.type);
        state = reduce(state, action);
        stats.decisions++;
      }
    }

    for (const event of state.events) {
      if (event.type === 'showdown') stats.sawShowdown = true;
      // Every event the engine emits has to be renderable in every language the interface offers — a missing translation is a blank line on the felt.
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
    expect(stats.playerHandOddsReadings).toBeGreaterThan(20);
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
          equity: equityProvider,
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
