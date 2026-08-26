import { describe, expect, it } from 'vitest';
import {
  allCanonicalLabels,
  combinationsFor,
  lookupPreflop,
} from '../poker-math/preflop-equity.ts';
import { seededRng } from '../poker-math/rng.ts';
import { createSession, reduce } from '../engine/engine.ts';
import { enumerateLegalActions } from '../engine/random-play.ts';
import { positionAt } from '../engine/test-fixtures.ts';
import { IllegalActionError, type PlayerAction, type SessionState } from '../engine/types.ts';
import {
  A_NEAR_CERTAIN_WINNER,
  callThresholdFor,
  decide,
  decideWithEquity,
  explainDecision,
  potOdds,
  raiseThresholdFor,
} from './decide.ts';
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
  hole?: string;
}): BotView {
  const { potTotal, callAmount } = options;
  const stack = options.stack ?? 200;
  const state = positionAt({
    seats: [
      { stack, hole: options.hole ?? 'Ah Kd', streetCommitted: 0, committed: potTotal - callAmount },
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

describe('the reasons behind a decision are the decision', () => {
  // The measurement in `behaviour.ts` reports on what the Bots did, which means
  // it has to know *why*. An instrumented copy of the rule would drift from the
  // real one the first time either was edited, so there is no copy: the reasons
  // fall out of the same call that produced the action.
  it('gives the same action as the plain decision, for every personality and seed', () => {
    const views = [
      viewFacing({ potTotal: 100, callAmount: 2 }),
      viewFacing({ potTotal: 40, callAmount: 10 }),
      viewFacing({ potTotal: 3, callAmount: 2, street: 'preflop' }),
      viewFacing({ potTotal: 60, callAmount: 0 }),
    ];
    for (const view of views) {
      for (const personality of everyPersonality) {
        for (let seed = 0; seed < 40; seed++) {
          const equity = (seed % 20) * 0.05;
          const plain = decideWithEquity(view, personality, equity, seededRng(seed));
          const explained = explainDecision(view, personality, equity, seededRng(seed));
          expect(explained.action, `${personality.key} seed ${seed}`).toEqual(plain);
        }
      }
    }
  });

  it('calls aggression aggression, and nothing else', () => {
    const view = viewFacing({ potTotal: 60, callAmount: 0 });
    for (let seed = 0; seed < 100; seed++) {
      const { action, reasons } = explainDecision(view, PERSONALITIES.LAG, 0.3, seededRng(seed));
      const fired = action.type === 'bet' || action.type === 'raise' || action.type === 'all-in';
      expect(reasons.aggressive, `seed ${seed}`).toBe(fired);
      expect(reasons.raiseTo === null, `seed ${seed}`).toBe(!fired);
    }
  });

  it('reports aggression its own raising standard rejected as bluff-driven', () => {
    // This is the whole of what the Player means by "was that a bluff?": the
    // Bot put chips in with a Hand its own standard would not have raised.
    const view = viewFacing({ potTotal: 60, callAmount: 20 });
    let bluffs = 0;
    for (let seed = 0; seed < 400; seed++) {
      const { reasons } = explainDecision(view, PERSONALITIES.Bluffer, 0.2, seededRng(seed));
      if (!reasons.aggressive) continue;
      expect(reasons.bluffDriven, `seed ${seed}`).toBe(!reasons.wantsToRaise);
      if (reasons.bluffDriven) bluffs += 1;
    }
    expect(bluffs).toBeGreaterThan(0);
  });

  it('says when the legal maximum, rather than the Bot, chose the amount', () => {
    // Facing 12 with 20 behind: even sized against the Stack the raise overshoots
    // what the Seat holds, so the clamp turns it into a push. This is now the
    // exception rather than 11% of all aggression.
    const view = viewFacing({ potTotal: 200, callAmount: 12, stack: 20 });
    let clamped = 0;
    for (let seed = 0; seed < 80; seed++) {
      const { action, reasons } = explainDecision(view, PERSONALITIES.LAG, 0.95, seededRng(seed));
      if (!reasons.clampedDown) continue;
      clamped += 1;
      expect(action.type, `seed ${seed}`).toBe('all-in');
      expect(reasons.intendedRaiseTo).toBeGreaterThan(view.legalActions.maxRaiseTo);
    }
    expect(clamped).toBeGreaterThan(0);
  });
});

describe('the Opening Range, and the contradiction it replaced', () => {
  /** First in before the flop: the blinds are up, nobody has raised. */
  const firstIn = (hole: string): BotView => {
    const state = positionAt({
      seats: [
        { stack: 100, hole, streetCommitted: 0 },
        { stack: 98, hole: '2c 3d', streetCommitted: 2 },
        { stack: 95, hole: '5c 6d', streetCommitted: 5 },
      ],
      street: 'preflop',
      currentBet: 5,
      buttonSeat: 2,
      actorSeat: 0,
    });
    return makeBotView(state, 0);
  };

  it('opens the top share of Hands its personality claims, and no more', () => {
    // Weighted by combinations, because that is what a percentile is a share of.
    // This is the property the constant is *for*: "the top 10%" has to mean the
    // top 10%, or the number is decoration.
    for (const personality of everyPersonality) {
      let opened = 0;
      for (const label of allCanonicalLabels()) {
        const view = firstIn(`${label[0]}h ${label[1]}${label[2] === 's' ? 'h' : 'd'}`);
        const { reasons } = explainDecision(view, personality, 0.5, seededRng(1));
        if (reasons.wantsToRaise) opened += combinationsFor(label);
      }
      expect(opened / 1326, personality.key).toBeLessThanOrEqual(personality.openingRange);
      expect(opened, `${personality.key} opens nothing at all`).toBeGreaterThan(0);
    }
  });

  it('never opens a random Hand simply because it is above average', () => {
    // The old standard was an even share of the pot plus a margin. Six-handed
    // that is 0.167, which is by definition the Equity of a random Hand, so a
    // small margin on top said "raise with anything above average".
    for (const personality of everyPersonality) {
      const { reasons } = explainDecision(firstIn('7h 2d'), personality, 0.9, seededRng(1));
      expect(reasons.wantsToRaise, `${personality.key} raises 7-2`).toBe(false);
    }
  });

  it('tightens the range as the price climbs, so a raising war can end', () => {
    // First in, the whole range opens. Against a raise only its strongest part
    // does — otherwise a Hand that clears the range re-raises for ever, and a
    // 20 BB table cannot survive that.
    const facingARaise = (hole: string, currentBet: number): BotView => {
      const state = positionAt({
        seats: [
          { stack: 100, hole, streetCommitted: 5, committed: 5 },
          { stack: 100 - currentBet, hole: '2c 3d', streetCommitted: currentBet },
        ],
        street: 'preflop',
        currentBet,
        actorSeat: 0,
      });
      return makeBotView(state, 0);
    };
    // A middling suited ace opens first in for the Bluffer, but folds to a
    // four-bet. Aces raise whatever the price.
    const opens = (hole: string, bet: number) =>
      explainDecision(facingARaise(hole, bet), PERSONALITIES.Bluffer, 0.5, seededRng(1)).reasons
        .wantsToRaise;
    expect(opens('Ah 8h', 5)).toBe(true);
    expect(opens('Ah 8h', 40)).toBe(false);
    expect(opens('Ah As', 40)).toBe(true);
  });

  it('never folds a Hand it was simultaneously strong enough to raise with', () => {
    // The contradiction: the fold test used to run first, and before the flop the
    // calling threshold is the higher of the two — so a Hand strong enough to
    // raise got folded instead. It held in 54.2% of preflop decisions and threw
    // away 14.0% of every preflop fold in the game.
    let checked = 0;
    for (const personality of everyPersonality) {
      for (const label of allCanonicalLabels()) {
        const view = firstIn(`${label[0]}h ${label[1]}${label[2] === 's' ? 'h' : 'd'}`);
        for (let seed = 0; seed < 3; seed++) {
          const { action, reasons } = explainDecision(view, personality, 0.4, seededRng(seed));
          checked += 1;
          if (action.type !== 'fold') continue;
          expect(reasons.wantsToRaise, `${personality.key} folded ${label}`).toBe(false);
        }
      }
    }
    expect(checked).toBeGreaterThan(2000);
  });

  it('leaves the standard after the flop alone, where it is well behaved', () => {
    // Postflop the calling threshold is the lower of the two at every price
    // measured, so the contradiction never arose there and nothing about the
    // even-share form needs replacing.
    const view = viewFacing({ potTotal: 60, callAmount: 20 });
    for (const personality of everyPersonality) {
      const { reasons } = explainDecision(view, personality, 0.9, seededRng(2));
      expect(reasons.startingHandPercentile, personality.key).toBeNull();
      expect(reasons.raiseThreshold, personality.key).toBeCloseTo(
        1 / 3 + personality.raiseMargin,
        9,
      );
    }
  });
});

describe('the personalities differ in the right direction', () => {
  /**
   * Deal every one of the 169 starting Hands, weighted by how often it is
   * actually dealt, and count what happened.
   *
   * The sweep is over Hands rather than over Equity because before the flop the
   * entry standard is an Opening Range: a Bot looks at its two cards, not at a
   * number. Sweeping Equity against one fixed holding would now measure nothing.
   */
  function tendencies(key: PersonalityKey) {
    const personality = PERSONALITIES[key];
    let entered = 0;
    let raised = 0;
    let decisions = 0;

    for (const label of allCanonicalLabels()) {
      const hole = `${label[0]}h ${label[1]}${label[2] === 's' ? 'h' : 'd'}`;
      const weight = combinationsFor(label);
      // A realistic preflop price: 3 in the pot, 2 to call.
      const view = viewFacing({ potTotal: 3, callAmount: 2, street: 'preflop', hole });
      const equity = lookupPreflop(label, view.opponentCount)!.equity;

      for (let seed = 0; seed < 4; seed++) {
        const action = decideWithEquity(view, personality, equity, seededRng(seed * 7919 + 13));
        decisions += weight;
        if (action.type !== 'fold') entered += weight;
        if (action.type === 'raise' || action.type === 'bet' || action.type === 'all-in') {
          raised += weight;
        }
      }
    }
    return { entryRate: entered / decisions, raiseRate: raised / decisions };
  }

  it('has the Rock entering fewer pots than the Calling Station', () => {
    expect(tendencies('Rock').entryRate).toBeLessThan(tendencies('CallingStation').entryRate);
  });

  it('has the Bluffer raising more than the TAG', () => {
    expect(tendencies('Bluffer').raiseRate).toBeGreaterThan(tendencies('TAG').raiseRate);
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

describe('nobody checks a Hand that cannot lose', () => {
  it('caps the raising threshold below a near-certain winner, whatever the margin', () => {
    for (const personality of everyPersonality) {
      for (let opponents = 1; opponents <= 5; opponents++) {
        const threshold = raiseThresholdFor(
          opponents,
          personality.raiseMargin,
          personality.equityNoise,
        );
        expect(threshold, `${personality.key} against ${opponents}`).toBeLessThanOrEqual(
          A_NEAR_CERTAIN_WINNER - personality.equityNoise,
        );
      }
    }
  });

  it('leaves the additive margin alone below the ceiling', () => {
    // Six-handed, an even share is 0.167 and nobody's margin reaches the cap, so
    // the form the personalities are tuned on is untouched. Only the extreme
    // passive end is capped, and only heads-up.
    for (const personality of everyPersonality) {
      expect(raiseThresholdFor(5, personality.raiseMargin, personality.equityNoise)).toBeCloseTo(
        1 / 6 + personality.raiseMargin,
        9,
      );
    }
    // Heads-up, only the loosest passive personality is above the line.
    expect(raiseThresholdFor(1, PERSONALITIES.Rock.raiseMargin, PERSONALITIES.Rock.equityNoise)) //
      .toBeCloseTo(0.5 + PERSONALITIES.Rock.raiseMargin, 9);
    expect(
      raiseThresholdFor(
        1,
        PERSONALITIES.CallingStation.raiseMargin,
        PERSONALITIES.CallingStation.equityNoise,
      ),
    ).toBeLessThan(0.5 + PERSONALITIES.CallingStation.raiseMargin);
  });

  it('never checks a near-certain winner, at any opponent count', () => {
    // Measured before the ceiling: Calling Station checked 3243 times holding
    // better than 85% Equity across a million decisions, once with 96.8%. The
    // identity behind it — highest Equity ever checked equals the raising
    // threshold plus the Equity noise — held for all five personalities.
    let checked = 0;
    for (const personality of everyPersonality) {
      for (const opponentCount of [1, 2, 3, 5]) {
        const view = viewFacing({ potTotal: 60, callAmount: 0, opponentCount });
        for (const trueEquity of [0.851, 0.9, 0.97, 1]) {
          for (let seed = 0; seed < 60; seed++) {
            const action = decideWithEquity(view, personality, trueEquity, seededRng(seed));
            checked += 1;
            expect(
              action.type,
              `${personality.key} checked ${trueEquity} against ${opponentCount}`,
            ).not.toBe('check');
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(4000);
  });

  it('still lets a passive personality be visibly passive', () => {
    // The ceiling must not turn the Calling Station into an aggressive Bot. It
    // has to keep raising less often than the LAG at every opponent count.
    const raiseRate = (key: PersonalityKey, opponentCount: number): number => {
      const view = viewFacing({ potTotal: 60, callAmount: 0, opponentCount });
      let raises = 0;
      for (let seed = 0; seed < 200; seed++) {
        const equity = 0.1 + (seed % 40) * 0.02;
        const action = decideWithEquity(view, PERSONALITIES[key], equity, seededRng(seed));
        if (action.type !== 'check') raises += 1;
      }
      return raises / 200;
    };
    for (const opponentCount of [1, 2, 5]) {
      expect(raiseRate('CallingStation', opponentCount)).toBeLessThan(
        raiseRate('LAG', opponentCount),
      );
      expect(raiseRate('Rock', opponentCount)).toBeLessThan(raiseRate('TAG', opponentCount));
    }
  });
});

describe('a strong draw is worth firing at', () => {
  /** A Seat on the flop holding `hole`, first to act into an unopened pot. */
  const onTheFlop = (hole: string, board: string, street: 'flop' | 'turn' | 'river' = 'flop') => {
    const state = positionAt({
      seats: [
        { stack: 200, hole, streetCommitted: 0, committed: 30 },
        { stack: 200, hole: '2c 3d', streetCommitted: 0, committed: 30 },
      ],
      street,
      board,
      currentBet: 0,
      actorSeat: 0,
    });
    return makeBotView(state, 0);
  };

  it('raises the nut flush draw and checks the pair, at the same Equity', () => {
    // Both Hands are handed exactly 30% Equity. Equity cannot tell them apart —
    // it averages the distribution away — so if the two behave differently, it is
    // Upside doing it.
    const draw = onTheFlop('Ah 7h', 'Kh 4h 2c');
    const pair = onTheFlop('8h 8d', 'Kc 4s 2d');

    let drawFired = 0;
    let pairFired = 0;
    for (let seed = 0; seed < 200; seed++) {
      if (explainDecision(draw, PERSONALITIES.LAG, 0.3, seededRng(seed)).reasons.wantsToRaise) {
        drawFired += 1;
      }
      if (explainDecision(pair, PERSONALITIES.LAG, 0.3, seededRng(seed)).reasons.wantsToRaise) {
        pairFired += 1;
      }
    }
    expect(drawFired).toBeGreaterThan(0);
    expect(drawFired).toBeGreaterThan(pairFired);
  });

  it('lowers a threshold in proportion to appetite, so the styles still differ', () => {
    const draw = onTheFlop('Ah 7h', 'Kh 4h 2c');
    const thresholdFor = (key: PersonalityKey) =>
      explainDecision(draw, PERSONALITIES[key], 0.3, seededRng(1)).reasons.raiseThreshold;

    expect(thresholdFor('Bluffer')).toBeLessThan(thresholdFor('TAG'));
    expect(thresholdFor('TAG')).toBeLessThan(thresholdFor('Rock'));
    expect(thresholdFor('Rock')).toBeLessThan(thresholdFor('CallingStation'));
  });

  it('leaves a Hand with nothing coming exactly where it was', () => {
    // Queen-high on a disconnected board has no Upside at all, so the appetite
    // has nothing to multiply and the threshold is the plain even-share form.
    const air = onTheFlop('Qh 4d', '9c 7s 2h');
    for (const personality of everyPersonality) {
      const { reasons } = explainDecision(air, personality, 0.3, seededRng(1));
      expect(reasons.upside, personality.key).toBe(0);
      expect(reasons.raiseThreshold, personality.key).toBeCloseTo(
        raiseThresholdFor(1, personality.raiseMargin, personality.equityNoise),
        9,
      );
    }
  });

  it('stops consulting Upside on the river, where the Hand is already made', () => {
    // On the river Upside is 0 or 1 rather than a probability. Treating a
    // certainty as an appetite would drop the threshold to nothing for every
    // made straight, so the Bots simply stop asking.
    const madeStraight = onTheFlop('9h 8d', '7c 6s 5h 2d Th', 'river');
    for (const personality of everyPersonality) {
      const { reasons } = explainDecision(madeStraight, personality, 0.9, seededRng(1));
      expect(reasons.upside, personality.key).toBe(0);
      expect(reasons.raiseThreshold, personality.key).toBeCloseTo(
        raiseThresholdFor(1, personality.raiseMargin, personality.equityNoise),
        9,
      );
    }
  });
});

describe('a bluff that remembers the Street before', () => {
  /**
   * A Seat on the turn, first to act into an unopened pot.
   *
   * First to act on purpose: acting last is its own reason to bluff, and two
   * reasons together reach the ceiling that stops any Bot becoming certain to
   * fire. Isolating the continuation keeps this measuring one thing.
   */
  const onTheTurn = (options: { hole: string; board: string; led: boolean }) => {
    const state = positionAt({
      seats: [
        { stack: 200, hole: options.hole, streetCommitted: 0, committed: 40 },
        { stack: 200, hole: '2c 3d', streetCommitted: 0, committed: 40 },
      ],
      street: 'turn',
      board: options.board,
      currentBet: 0,
      buttonSeat: 1,
      lastStreetAggressor: options.led ? 0 : 1,
      actorSeat: 0,
    });
    return makeBotView(state, 0);
  };

  const firesWithNothing = (view: BotView, key: PersonalityKey): number => {
    let fired = 0;
    for (let seed = 0; seed < 600; seed++) {
      // 6% Equity: the raising standard is nowhere near met, so anything that
      // goes in is the bluff roll and nothing else.
      const action = decideWithEquity(view, PERSONALITIES[key], 0.06, seededRng(seed));
      if (action.type !== 'check') fired += 1;
    }
    return fired / 600;
  };

  it('knows whether it was the Seat that led, and nothing more', () => {
    expect(onTheTurn({ hole: 'Qh 4d', board: '9c 7s 2h Td', led: true }).wasAggressor).toBe(true);
    expect(onTheTurn({ hole: 'Qh 4d', board: '9c 7s 2h Td', led: false }).wasAggressor).toBe(false);
  });

  it('fires the turn more often when it fired the flop', () => {
    // Measured before this existed, the memorylessness was exact: for every
    // personality, the chance of bluffing the turn was the same whether or not it
    // had bluffed the flop, and 0.19 two-barrel stories happened per Session.
    for (const key of PERSONALITY_KEYS) {
      if (PERSONALITIES[key].bluffFrequency < 0.05) continue; // too rare to measure
      const board = '9c 7s 2h Td';
      const led = firesWithNothing(onTheTurn({ hole: 'Qh 4d', board, led: true }), key);
      const didNot = firesWithNothing(onTheTurn({ hole: 'Qh 4d', board, led: false }), key);
      expect(led, `${key} continued no more often than it opened`).toBeGreaterThan(didNot);
    }
  });

  it('fires harder still when the Hand can still get there', () => {
    // A live flush draw against a busted one, both continuing. This is what stops
    // the give-up being a confession: the Player cannot see which just checked.
    //
    // Measured on the tightest of the aggressive personalities, because the
    // loosest are already at the ceiling that stops any Bot becoming certain to
    // fire, and two numbers pinned to the same ceiling compare nothing.
    const live = onTheTurn({ hole: 'Ah 7h', board: 'Kh 4h 2c Td', led: true });
    const dead = onTheTurn({ hole: 'Qh 4d', board: '9c 7s 2h Td', led: true });
    expect(firesWithNothing(live, 'TAG')).toBeGreaterThan(firesWithNothing(dead, 'TAG'));
  });

  it('does not lean on a story it never started', () => {
    // Upside alone must not continue anything for a Seat that checked the flop,
    // or the record would be decoration.
    const board = 'Kh 4h 2c Td';
    expect(firesWithNothing(onTheTurn({ hole: 'Ah 7h', board, led: false }), 'TAG')).toBeLessThan(
      firesWithNothing(onTheTurn({ hole: 'Ah 7h', board, led: true }), 'TAG'),
    );
  });
});

describe('Position, which the Bots could never see before', () => {
  /** Six Seats, Button on `buttonSeat`, `folded` already out of the Hand. */
  const table = (buttonSeat: number, folded: readonly number[] = []) =>
    positionAt({
      seats: Array.from({ length: 6 }, (_, index) => ({
        stack: 100,
        hole: 'Ah Kd',
        folded: folded.includes(index),
        streetCommitted: 0,
      })),
      street: 'flop',
      board: '2h 7s 9c',
      currentBet: 0,
      buttonSeat,
      actorSeat: (buttonSeat + 1) % 6,
    });

  it('puts the Seat left of the Button first and the Button last', () => {
    const state = table(0);
    expect(makeBotView(state, 1).position).toBe(0);
    expect(makeBotView({ ...state, legalActions: { ...state.legalActions!, seat: 0 } }, 0).position) //
      .toBe(1);
  });

  it('is derived from who is still in, not from the seat number', () => {
    // Everyone between this Seat and the Button folds: it is now last to act,
    // whatever its index says. Position is not a seat number (CONTEXT.md).
    const state = table(0, [4, 5, 0]);
    const view = makeBotView({ ...state, legalActions: { ...state.legalActions!, seat: 3 } }, 3);
    expect(view.position).toBe(1);
  });

  it('moves with the Button, Hand by Hand', () => {
    const positionOfSeatOne = (buttonSeat: number) => {
      const state = table(buttonSeat);
      return makeBotView({ ...state, legalActions: { ...state.legalActions!, seat: 1 } }, 1)
        .position;
    };
    expect(positionOfSeatOne(0)).toBe(0);
    expect(positionOfSeatOne(1)).toBe(1);
    expect(positionOfSeatOne(2)).toBeCloseTo(4 / 5, 9);
  });

  it('opens a wider range on the Button than under the gun', () => {
    // The gap is the whole point: it is something a Player can watch for, work
    // out, and then exploit, which is the most valuable thing at this table.
    const openingRate = (key: PersonalityKey, position: number) => {
      let opened = 0;
      let dealt = 0;
      for (const label of allCanonicalLabels()) {
        const hole = `${label[0]}h ${label[1]}${label[2] === 's' ? 'h' : 'd'}`;
        const weight = combinationsFor(label);
        const view = { ...viewFacing({ potTotal: 3, callAmount: 2, street: 'preflop', hole }), position };
        dealt += weight;
        if (explainDecision(view, PERSONALITIES[key], 0.4, seededRng(1)).reasons.wantsToRaise) {
          opened += weight;
        }
      }
      return opened / dealt;
    };

    for (const key of PERSONALITY_KEYS) {
      const onTheButton = openingRate(key, 1);
      const underTheGun = openingRate(key, 0);
      expect(onTheButton, `${key} on the Button`).toBeGreaterThan(underTheGun);
      // And the range still means what it says at the widest end.
      expect(onTheButton, `${key} opens more than its range allows`).toBeLessThanOrEqual(
        PERSONALITIES[key].openingRange * 1.5,
      );
    }
  });

  it('bluffs more often when it acts last', () => {
    const bluffRate = (position: number) => {
      const view = { ...viewFacing({ potTotal: 60, callAmount: 0 }), position };
      let fired = 0;
      for (let seed = 0; seed < 600; seed++) {
        if (decideWithEquity(view, PERSONALITIES.LAG, 0.06, seededRng(seed)).type !== 'check') {
          fired += 1;
        }
      }
      return fired / 600;
    };
    expect(bluffRate(1)).toBeGreaterThan(bluffRate(0));
  });

  it('never becomes certain to fire, however many reasons it has', () => {
    // Led last Street, acting last, and the loosest personality at the table. A
    // Bot that always bets here is not aggressive, it is a lookup table.
    const view = {
      ...viewFacing({ potTotal: 60, callAmount: 0 }),
      position: 1,
      wasAggressor: true,
      opponentCount: 1,
    };
    const checks = Array.from(
      { length: 400 },
      (_, seed) => decideWithEquity(view, PERSONALITIES.Bluffer, 0.06, seededRng(seed)).type,
    ).filter((type) => type === 'check').length;
    expect(checks).toBeGreaterThan(0);
  });
});

describe('a short Stack takes a shot, or refuses to', () => {
  /**
   * A Seat with `stack` chips on the turn, first to act into an unopened pot,
   * against one opponent deep enough not to be the binding constraint.
   */
  const shortOnTheTurn = (hole: string, board: string, stack: number): BotView => {
    const state = positionAt({
      seats: [
        { stack, hole, streetCommitted: 0, committed: 60 },
        { stack: 400, hole: '2c 3d', streetCommitted: 0, committed: 60 },
      ],
      street: 'turn',
      board,
      currentBet: 0,
      actorSeat: 0,
    });
    return makeBotView(state, 0);
  };

  const pushRate = (view: BotView, key: PersonalityKey): number => {
    let pushes = 0;
    for (let seed = 0; seed < 120; seed++) {
      // 12% Equity: nothing here is a value bet. Anything that goes in is either
      // the bluff roll or a considered gamble.
      if (decideWithEquity(view, PERSONALITIES[key], 0.12, seededRng(seed)).type === 'all-in') {
        pushes += 1;
      }
    }
    return pushes / 120;
  };

  it('carries the effective Stack, which is what is really at risk', () => {
    // 20 BB against an opponent holding 4 makes this a 4 BB pot.
    const state = positionAt({
      seats: [
        { stack: 100, hole: 'Ah Kd' },
        { stack: 20, hole: '2c 3d' },
        { stack: 15, hole: '5c 6d', folded: true },
      ],
      street: 'flop',
      board: '2h 7s 9c',
      currentBet: 0,
      actorSeat: 0,
    });
    const view = makeBotView(state, 0);
    expect(view.stack).toBe(100);
    expect(view.effectiveStack).toBe(20);
  });

  it('pushes a live draw and lets a dead Hand go', () => {
    // Both Hands are handed 12% Equity. Only Upside tells them apart, which is
    // the whole reason it exists.
    const draw = shortOnTheTurn('Ah 7h', 'Kh 4h 2c Td', 15);
    const dead = shortOnTheTurn('Qh 4d', '9c 7s 2h Td', 15);
    expect(pushRate(draw, 'Bluffer')).toBeGreaterThan(0);
    expect(pushRate(dead, 'Bluffer')).toBe(0);
  });

  it('will not gamble a Stack that is not short', () => {
    // Grinding is a slow death only when there is little left to grind.
    const draw = shortOnTheTurn('Ah 7h', 'Kh 4h 2c Td', 400);
    expect(pushRate(draw, 'Bluffer')).toBe(0);
  });

  it('has somebody who gambles readily and somebody who refuses outright', () => {
    // Differentiation is a hard requirement, not a nice-to-have: working out who
    // does what is the most valuable thing there is to learn at this table.
    const draw = shortOnTheTurn('Ah 7h', 'Kh 4h 2c Td', 15);
    expect(pushRate(draw, 'Bluffer'), 'the Bluffer refused a shot').toBeGreaterThan(0);
    expect(pushRate(draw, 'LAG'), 'the LAG refused a shot').toBeGreaterThan(0);
    expect(pushRate(draw, 'Rock'), 'the Rock gambled').toBe(0);
    expect(pushRate(draw, 'CallingStation'), 'the Calling Station gambled').toBe(0);
  });

  it('pushes rather than calling when raising is not legal but pushing is', () => {
    // The right to push never goes away, so at a depth where no legal raise
    // exists, pushing is what raising means. Before this, a Bot holding aces with
    // under two big blinds behind called them off instead.
    const state = positionAt({
      seats: [
        { stack: 8, hole: 'Ah As', streetCommitted: 0, committed: 5 },
        { stack: 200, hole: '2c 3d', streetCommitted: 5, committed: 5 },
      ],
      street: 'preflop',
      currentBet: 5,
      actorSeat: 0,
    });
    const view = makeBotView(state, 0);
    expect(view.legalActions.canRaise).toBe(false);
    expect(view.legalActions.canAllIn).toBe(true);
    for (const personality of everyPersonality) {
      const action = decideWithEquity(view, personality, 0.85, seededRng(3));
      expect(action.type, `${personality.key} did not push aces`).toBe('all-in');
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
      const action = decideWithEquity(view, PERSONALITIES.Bluffer, 0.9, seededRng(seed));
      if (action.type === 'bet' || action.type === 'raise') {
        expect(action.to).toBeGreaterThanOrEqual(view.legalActions.minRaiseTo);
        expect(action.to).toBeLessThanOrEqual(view.legalActions.maxRaiseTo);
      }
    }
  });

  it('bets what the Stack can afford, not five times it', () => {
    // A Stack of 30 into a pot of 200. Sized off the pot alone the intended bet
    // is well over the Stack every time, and the legal maximum — not the Bot —
    // decides the action.
    const view = viewFacing({ potTotal: 200, callAmount: 0, stack: 30 });
    for (const personality of everyPersonality) {
      for (let seed = 0; seed < 60; seed++) {
        const { reasons } = explainDecision(view, personality, 0.95, seededRng(seed));
        if (!reasons.aggressive) continue;
        expect(
          reasons.intendedRaiseTo,
          `${personality.key} seed ${seed} wanted ${reasons.intendedRaiseTo} holding 30`,
        ).toBeLessThanOrEqual(view.legalActions.maxRaiseTo);
      }
    }
  });

  it('still sizes off the pot when the Stack is deep enough not to matter', () => {
    // 400 behind into a pot of 60: the Stack is not the binding constraint, so
    // the bet is the pot fraction it always was.
    const view = viewFacing({ potTotal: 60, callAmount: 0, stack: 400 });
    const { min, max } = PERSONALITIES.TAG.betSizing;
    for (let seed = 0; seed < 60; seed++) {
      const { action, reasons } = explainDecision(view, PERSONALITIES.TAG, 0.95, seededRng(seed));
      if (action.type !== 'bet') continue;
      const share = (reasons.raiseTo! - view.currentBet) / view.potTotal;
      expect(share, `seed ${seed}`).toBeGreaterThanOrEqual(min - 0.02);
      expect(share, `seed ${seed}`).toBeLessThanOrEqual(max + 0.02);
    }
  });

  it('leaves a short Stack still varying its bets, not repeating one number', () => {
    const view = viewFacing({ potTotal: 200, callAmount: 0, stack: 60 });
    const sizes = new Set<number>();
    for (let seed = 0; seed < 80; seed++) {
      const action = decideWithEquity(view, PERSONALITIES.LAG, 0.9, seededRng(seed));
      if (action.type === 'bet' || action.type === 'raise') sizes.add(action.to);
    }
    expect(sizes.size).toBeGreaterThan(3);
  });
});

describe('the big blind’s option', () => {
  /** Everyone limps to the big blind, who may check or raise but not "bet". */
  const bigBlindOption = (hole = 'Ah As'): BotView => {
    const state = positionAt({
      seats: [
        { stack: 198, hole: '3c 4d', streetCommitted: 2, hasActed: true },
        { stack: 199, hole: '5c 6d', streetCommitted: 2, hasActed: true },
        { stack: 198, hole, streetCommitted: 2 }, // the big blind
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
    // 9-4 offsuit is outside every personality's Opening Range, so the only
    // aggression left here is the bluff roll.
    const view = bigBlindOption('9h 4d');
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
      decideWithEquity(view, PERSONALITIES.Bluffer, 0.9, seededRng(seed)),
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
      'effectiveStack',
      'position',
      'wasAggressor',
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
