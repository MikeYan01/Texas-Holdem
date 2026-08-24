import { describe, expect, it } from 'vitest';
import { seededRng } from '../poker-math/rng.ts';
import { createSession, reduce } from '../engine/engine.ts';
import { enumerateLegalActions } from '../engine/random-play.ts';
import { positionAt } from '../engine/test-fixtures.ts';
import { IllegalActionError, type PlayerAction, type SessionState } from '../engine/types.ts';
import { callThresholdFor, decide, decideWithEquity, potOdds } from './decide.ts';
import { PERSONALITIES, PERSONALITY_KEYS } from './personalities.ts';
import { assignPersonalities, makeBotView } from './view.ts';
import type { BotView, PersonalityKey } from './types.ts';

const everyPersonality = PERSONALITY_KEYS.map((key) => PERSONALITIES[key]);

/** A view for a Seat facing `callAmount` into `potTotal`. */
function viewFacing(options: {
  potTotal: number;
  callAmount: number;
  opponentCount?: number;
  street?: 'preflop' | 'flop';
  stack?: number;
}): BotView {
  const { potTotal, callAmount } = options;
  const stack = options.stack ?? 200;
  const state = positionAt({
    seats: [
      { stack, hole: 'Ah Kd', streetCommitted: 0, committed: potTotal - callAmount },
      { stack: 200, hole: '2c 3d', streetCommitted: callAmount, committed: callAmount },
      { stack: 200, hole: '5c 6d', streetCommitted: callAmount, committed: callAmount },
    ],
    street: options.street ?? 'flop',
    board: options.street === 'preflop' ? '' : '2h 7s 9c',
    currentBet: callAmount,
    actorSeat: 0,
  });
  return {
    ...makeBotView(state, 0),
    potTotal,
    opponentCount: options.opponentCount ?? 2,
    street: options.street ?? 'flop',
  };
}

describe('potOdds', () => {
  it('is the share of the pot the call costs', () => {
    expect(potOdds(2, 100)).toBeCloseTo(2 / 102, 6);
    expect(potOdds(50, 50)).toBeCloseTo(0.5, 6);
  });

  it('is zero when checking is free', () => {
    expect(potOdds(0, 100)).toBe(0);
  });
});

describe('the reason ADR-0003 exists', () => {
  it('shrinks the cushion with the price instead of taxing every call the same', () => {
    // At a normal price the flat margin is what applies...
    expect(callThresholdFor(0.4, 0.2)).toBeCloseTo(0.6, 6);
    // ...and the two forms agree exactly at the reference price of a tenth.
    expect(callThresholdFor(0.1, 0.2)).toBeCloseTo(0.3, 6);
    // Below it the cushion shrinks with the price, so a nearly-free call at 2%
    // of the pot costs a fraction of a percent, not a flat twenty points.
    expect(callThresholdFor(0.02, 0.2)).toBeCloseTo(0.06, 6);
    expect(callThresholdFor(0.02, 0.2)).toBeLessThan(0.22);
  });

  it('gets no Bot to fold when the pot dwarfs the call', () => {
    // 100 in the middle, 2 to call: around 2% Equity makes it correct. An
    // absolute threshold would throw this pot away, which is the exact mistake a
    // human spots instantly.
    const view = viewFacing({ potTotal: 100, callAmount: 2 });
    for (const personality of everyPersonality) {
      for (let seed = 0; seed < 40; seed++) {
        const action = decideWithEquity(view, personality, 0.25, seededRng(seed));
        expect(action.type, `${personality.key} with seed ${seed}`).not.toBe('fold');
      }
    }
  });

  it('holds before the flop too, where the entry range is tightest', () => {
    const view = viewFacing({ potTotal: 100, callAmount: 2, street: 'preflop' });
    for (const personality of everyPersonality) {
      for (let seed = 0; seed < 40; seed++) {
        const action = decideWithEquity(view, personality, 0.25, seededRng(seed));
        expect(action.type, `${personality.key} with seed ${seed}`).not.toBe('fold');
      }
    }
  });

  it('does get Bots to fold the same Equity when the price is bad', () => {
    // Same hand strength, but now the call costs most of the pot.
    const view = viewFacing({ potTotal: 100, callAmount: 90 });
    const folds = everyPersonality.filter(
      (personality) => decideWithEquity(view, personality, 0.25, seededRng(3)).type === 'fold',
    );
    expect(folds.length).toBeGreaterThan(0);
  });
});

describe('the personalities differ in the right direction', () => {
  /** Play the same spread of spots many times and count what happened. */
  function tendencies(key: PersonalityKey) {
    const personality = PERSONALITIES[key];
    let entered = 0;
    let raised = 0;
    let decisions = 0;

    for (let seed = 0; seed < 400; seed++) {
      const rng = seededRng(seed * 7919 + 13);
      // A realistic preflop price: 3 in the pot, 2 to call.
      const view = viewFacing({ potTotal: 3, callAmount: 2, street: 'preflop' });
      const equity = 0.1 + (seed % 50) * 0.012; // a sweep of hand strengths
      const action = decideWithEquity(view, personality, equity, rng);
      decisions++;
      if (action.type !== 'fold') entered++;
      if (action.type === 'raise' || action.type === 'bet' || action.type === 'all-in') raised++;
    }
    return { entryRate: entered / decisions, raiseRate: raised / decisions };
  }

  it('has the Rock entering fewer pots than the Calling Station', () => {
    expect(tendencies('Rock').entryRate).toBeLessThan(tendencies('CallingStation').entryRate);
  });

  it('has the Maniac raising more than the TAG', () => {
    expect(tendencies('Maniac').raiseRate).toBeGreaterThan(tendencies('TAG').raiseRate);
  });

  it('has the LAG entering more pots than the TAG', () => {
    expect(tendencies('LAG').entryRate).toBeGreaterThan(tendencies('TAG').entryRate);
  });

  it('has the Calling Station raising less than the LAG', () => {
    expect(tendencies('CallingStation').raiseRate).toBeLessThan(tendencies('LAG').raiseRate);
  });

  it('leaves every personality actually playing some hands', () => {
    for (const key of PERSONALITY_KEYS) {
      const { entryRate } = tendencies(key);
      expect(entryRate, key).toBeGreaterThan(0);
      expect(entryRate, key).toBeLessThanOrEqual(1);
    }
  });
});

describe('bet sizing', () => {
  it('varies rather than repeating one number', () => {
    const view = viewFacing({ potTotal: 60, callAmount: 0 });
    const sizes = new Set<number>();
    for (let seed = 0; seed < 60; seed++) {
      const action = decideWithEquity(view, PERSONALITIES.LAG, 0.9, seededRng(seed));
      if (action.type === 'bet' || action.type === 'raise') sizes.add(action.to);
    }
    expect(sizes.size).toBeGreaterThan(3);
  });

  it('stays inside what the engine allows', () => {
    const view = viewFacing({ potTotal: 60, callAmount: 10 });
    for (let seed = 0; seed < 200; seed++) {
      const action = decideWithEquity(view, PERSONALITIES.Maniac, 0.9, seededRng(seed));
      if (action.type === 'bet' || action.type === 'raise') {
        expect(action.to).toBeGreaterThanOrEqual(view.legalActions.minRaiseTo);
        expect(action.to).toBeLessThanOrEqual(view.legalActions.maxRaiseTo);
      }
    }
  });
});

describe('the big blind’s option', () => {
  /** Everyone limps to the big blind, who may check or raise but not "bet". */
  const bigBlindOption = (): BotView => {
    const state = positionAt({
      seats: [
        { stack: 198, hole: '3c 4d', streetCommitted: 2, hasActed: true },
        { stack: 199, hole: '5c 6d', streetCommitted: 2, hasActed: true },
        { stack: 198, hole: 'Ah As', streetCommitted: 2 }, // the big blind
        { stack: 198, hole: '7c 8d', streetCommitted: 2, hasActed: true },
      ],
      street: 'preflop',
      currentBet: 2,
      lastRaiseSize: 2,
      buttonSeat: 3,
      actorSeat: 2,
    });
    return makeBotView(state, 2);
  };

  it('is the one spot where checking and raising are both legal', () => {
    const legal = bigBlindOption().legalActions;
    expect(legal.canCheck).toBe(true);
    expect(legal.canBet).toBe(false); // the blind already counts as a bet
    expect(legal.canRaise).toBe(true);
  });

  it('does not leave every personality checking it, whatever it holds', () => {
    // Aces in the big blind against four limpers. A Bot that always checks here
    // never punishes a limped pot, and all five personalities look identical in
    // a spot that comes up roughly once every five Hands.
    const view = bigBlindOption();
    for (const personality of everyPersonality) {
      const actions = Array.from({ length: 200 }, (_, seed) =>
        decideWithEquity(view, personality, 0.85, seededRng(seed)).type,
      );
      expect(
        actions.filter((type) => type === 'raise' || type === 'all-in').length,
        `${personality.key} never raised the option`,
      ).toBeGreaterThan(0);
    }
  });

  it('still takes the free card with a weak hand', () => {
    const view = bigBlindOption();
    for (const personality of everyPersonality) {
      const actions = Array.from({ length: 200 }, (_, seed) =>
        decideWithEquity(view, personality, 0.08, seededRng(seed)).type,
      );
      expect(
        actions.filter((type) => type === 'check').length,
        `${personality.key} never checked the option`,
      ).toBeGreaterThan(0);
      // Nobody folds a hand they are allowed to see a flop with for nothing.
      expect(actions).not.toContain('fold');
    }
  });

  it('raises with a word the engine accepts', () => {
    const view = bigBlindOption();
    const raises = Array.from({ length: 200 }, (_, seed) =>
      decideWithEquity(view, PERSONALITIES.Maniac, 0.9, seededRng(seed)),
    ).filter((action) => action.type !== 'check');

    expect(raises.length).toBeGreaterThan(0);
    for (const action of raises) {
      // Never "bet": nothing is legal by that name once a blind is posted.
      expect(action.type).not.toBe('bet');
      if (action.type === 'raise') {
        expect(action.to).toBeGreaterThanOrEqual(view.legalActions.minRaiseTo);
        expect(action.to).toBeLessThanOrEqual(view.legalActions.maxRaiseTo);
      }
    }
  });
});

describe('every action a Bot returns is one the engine accepts', () => {
  it('survives a long run of real positions with all five personalities', () => {
    let illegal = 0;
    let decisions = 0;
    const kinds = new Set<string>();

    for (let seed = 0; seed < 60; seed++) {
      const rng = seededRng(seed + 1);
      let state: SessionState = createSession({ seed });
      const seating = assignPersonalities(6, state.playerSeat, seededRng(seed));

      for (let step = 0; step < 4000 && state.phase !== 'session-complete'; step++) {
        if (state.phase !== 'awaiting-action') {
          state = reduce(state, { type: 'advance' });
          continue;
        }
        const seat = state.actorSeat!;
        const key = seating.get(seat) ?? 'TAG';
        const view = makeBotView(state, seat);
        // A sweep of Equity values rather than the real one: the point is that
        // whatever the Bot decides is legal, including at the extremes.
        const equity = rng();
        const action: PlayerAction = decideWithEquity(view, PERSONALITIES[key], equity, rng);
        decisions++;
        kinds.add(action.type);

        const allowed = enumerateLegalActions(state.legalActions!).map((a) => a.type);
        expect(allowed, `${key} returned ${action.type}`).toContain(action.type);
        try {
          state = reduce(state, action);
        } catch (error) {
          if (error instanceof IllegalActionError) illegal++;
          throw error;
        }
      }
    }

    expect(illegal).toBe(0);
    expect(decisions).toBeGreaterThan(2000);
    // If the Bots only ever folded, the run would have proved very little.
    expect(kinds.size).toBeGreaterThanOrEqual(4);
  });
});

describe('a Bot cannot see what it should not', () => {
  it('has nowhere in the view to put another Seat’s cards', () => {
    const state = reduce(createSession({ seed: 77 }), { type: 'advance' });
    const view = makeBotView(state, state.actorSeat!);

    // Everything reachable from the view, flattened. The only cards in it are
    // this Seat's own two and the community cards everyone can see.
    const reachable = JSON.parse(JSON.stringify(view)) as Record<string, unknown>;
    expect(Object.keys(reachable)).toEqual([
      'seat',
      'holeCards',
      'board',
      'street',
      'potTotal',
      'opponentCount',
      'currentBet',
      'stack',
      'bigBlind',
      'legalActions',
    ]);

    const own = new Set(state.seats[state.actorSeat!]!.holeCards!);
    const others = state.seats
      .filter((seat) => seat.index !== state.actorSeat)
      .flatMap((seat) => seat.holeCards ?? []);
    const serialised = JSON.stringify(view);
    for (const card of others) {
      if (own.has(card)) continue;
      // Cards are integers, so look for the value in a position a card could
      // occupy rather than anywhere in the string.
      expect(view.holeCards).not.toContain(card);
      expect(view.board).not.toContain(card);
    }
    expect(serialised).toContain('"holeCards"');
  });

  it('reports only how many opponents are left, never who holds what', () => {
    const state = reduce(createSession({ seed: 78 }), { type: 'advance' });
    const view = makeBotView(state, state.actorSeat!);
    expect(view.opponentCount).toBe(5);
    expect(view.board).toEqual([]);
  });

  it('refuses to build a view for a Seat that is not to act', () => {
    const state = reduce(createSession({ seed: 79 }), { type: 'advance' });
    const other = (state.actorSeat! + 1) % 6;
    expect(() => makeBotView(state, other)).toThrow();
  });
});

describe('decisions replay from a seed', () => {
  it('gives the same action twice for the same seed', async () => {
    const view = viewFacing({ potTotal: 40, callAmount: 10 });
    const equity = async () => 0.42;
    const first = await decide(view, PERSONALITIES.LAG, { equity, rng: seededRng(5) });
    const second = await decide(view, PERSONALITIES.LAG, { equity, rng: seededRng(5) });
    expect(first).toEqual(second);
  });

  it('goes through the async Equity interface', async () => {
    const view = viewFacing({ potTotal: 40, callAmount: 10 });
    let asked: unknown = null;
    await decide(view, PERSONALITIES.TAG, {
      equity: async (request) => {
        asked = request;
        return 0.9;
      },
      rng: seededRng(1),
    });
    expect(asked).toMatchObject({ opponentCount: 2, board: view.board });
  });
});

describe('seating', () => {
  it('puts one of each personality at the table, away from the Player', () => {
    const seating = assignPersonalities(6, 3, seededRng(1));
    expect(seating.size).toBe(5);
    expect(seating.has(3)).toBe(false);
    expect(new Set(seating.values())).toEqual(new Set(PERSONALITY_KEYS));
  });

  it('shuffles the line-up between Sessions', () => {
    const layouts = new Set(
      Array.from({ length: 30 }, (_, seed) =>
        [...assignPersonalities(6, 0, seededRng(seed))].map(([, key]) => key).join(','),
      ),
    );
    expect(layouts.size).toBeGreaterThan(1);
  });
});
