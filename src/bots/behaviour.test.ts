import { describe, expect, it } from 'vitest';
import { positionAt } from '../engine/test-fixtures.ts';
import { seededRng } from '../poker-math/rng.ts';
import {
  A_BIG_BET,
  BehaviourTally,
  EQUITY_BANDS,
  STACK_DEPTHS,
  equityBandOf,
  stackDepthOf,
} from './behaviour.ts';
import { explainDecision, type DecisionReasons } from './decide.ts';
import { PERSONALITIES } from './personalities.ts';
import type { BotView } from './types.ts';
import { makeBotView } from './view.ts';

/** A Seat with `stack` chips facing `callAmount` into `potTotal`. */
function viewFor(options: {
  stack: number;
  potTotal: number;
  callAmount: number;
  street?: 'preflop' | 'flop' | 'turn';
  hole?: string;
}): BotView {
  const { stack, potTotal, callAmount } = options;
  const state = positionAt({
    seats: [
      {
        stack,
        hole: options.hole ?? 'Ah Kd',
        streetCommitted: 0,
        committed: potTotal - callAmount,
      },
      { stack: 400, hole: '2c 3d', streetCommitted: callAmount, committed: callAmount },
    ],
    street: options.street ?? 'flop',
    board: options.street === 'preflop' ? '' : '2h 7s 9c',
    currentBet: callAmount,
    actorSeat: 0,
  });
  return { ...makeBotView(state, 0), potTotal, street: options.street ?? 'flop' };
}

describe('the buckets the readout is reported in', () => {
  it('splits Stack depth at the points where the behaviour changes', () => {
    expect(stackDepthOf(4.9)).toBe('<5');
    expect(stackDepthOf(5)).toBe('5-10');
    expect(stackDepthOf(9.9)).toBe('5-10');
    expect(stackDepthOf(10)).toBe('10-20');
    // A full Stack is 20 BB, so the starting depth belongs to the deep bucket.
    expect(stackDepthOf(20)).toBe('10-20');
    expect(stackDepthOf(20.1)).toBe('>20');
  });

  it('splits Equity into fifths, air at the bottom and a lock at the top', () => {
    expect(equityBandOf(0)).toBe('<20');
    expect(equityBandOf(0.199)).toBe('<20');
    expect(equityBandOf(0.2)).toBe('20-40');
    expect(equityBandOf(0.8)).toBe('>80');
    expect(equityBandOf(1)).toBe('>80');
  });

  it('names every bucket exactly once, so the printed columns line up', () => {
    expect(new Set(STACK_DEPTHS).size).toBe(STACK_DEPTHS.length);
    expect(new Set(EQUITY_BANDS).size).toBe(EQUITY_BANDS.length);
  });
});

/** Feed one decision into a tally and hand back what it recorded. */
function tallyOne(view: BotView, equity: number, seed: number) {
  const tally = new BehaviourTally();
  tally.startHand();
  const { action, reasons } = explainDecision(view, PERSONALITIES.LAG, equity, seededRng(seed));
  tally.record('LAG', view, reasons, action.type);
  const report = tally.report(1);
  return { action, reasons, behaviour: report.perPersonality.find((b) => b.key === 'LAG')! };
}

/** A passive decision holding `trueEquity`, written down rather than played out. */
const checkingWith = (trueEquity: number): DecisionReasons => ({
  trueEquity,
  equity: trueEquity,
  potOdds: 0,
  callThreshold: 0,
  raiseThreshold: 1,
  upside: 0,
  startingHandPercentile: null,
  wantsToRaise: false,
  bluffing: false,
  aggressive: false,
  bluffDriven: false,
  intendedRaiseTo: null,
  raiseTo: null,
  clampedDown: false,
  allIn: false,
  chosenGamble: false,
  sizeFraction: null,
});

describe('the readout counts what the Bot actually did', () => {
  it('never counts a check as aggression, however the Bot got there', () => {
    const view = viewFor({ stack: 200, potTotal: 60, callAmount: 0 });
    for (let seed = 0; seed < 50; seed++) {
      const { action, reasons } = tallyOne(view, 0.05, seed);
      expect(reasons.aggressive, `seed ${seed}`).toBe(
        action.type === 'bet' || action.type === 'raise' || action.type === 'all-in',
      );
    }
  });

  it('counts a check made holding a near-certain winner', () => {
    // No personality can produce one any more — that is what the ceiling on the
    // raising threshold is for — so the counter is fed a decision directly. It
    // has to keep working, or the guard would silently stop guarding.
    const view = viewFor({ stack: 200, potTotal: 60, callAmount: 0 });
    const tally = new BehaviourTally();
    tally.startHand();
    tally.record('CallingStation', view, checkingWith(0.97), 'check');
    tally.record('CallingStation', view, checkingWith(0.5), 'check');

    const behaviour = tally.report(1).perPersonality.find((b) => b.key === 'CallingStation')!;
    expect(behaviour.checksHoldingALock).toBe(1);
    expect(behaviour.highestEquityChecked).toBeCloseTo(0.97, 9);
  });

  it('measures a big bet against the pot it is being fired into', () => {
    const view = viewFor({ stack: 400, potTotal: 60, callAmount: 0 });
    const { reasons, behaviour } = tallyOne(view, 0.95, 4);
    expect(reasons.aggressive).toBe(true);
    expect(behaviour.bigBets).toBe(reasons.sizeFraction! >= A_BIG_BET ? 1 : 0);
  });

  it('counts a push made where no legal raise existed', () => {
    // The readout once dropped these, because it gated every counter on being
    // able to bet or raise — and a Seat too short to reach the minimum raise can
    // do neither, which is exactly the state the chosen push exists to serve.
    // Four all-ins in every five went unreported.
    const view = viewFor({ stack: 8, potTotal: 200, callAmount: 5, street: 'preflop' });
    expect(view.legalActions.canBet || view.legalActions.canRaise).toBe(false);
    expect(view.legalActions.canAllIn).toBe(true);

    const tally = new BehaviourTally();
    tally.startHand();
    const { action, reasons } = explainDecision(view, PERSONALITIES.LAG, 0.9, seededRng(1));
    expect(action.type).toBe('all-in');
    tally.record('LAG', view, reasons, action.type);

    const behaviour = tally.report(1).perPersonality.find((b) => b.key === 'LAG')!;
    expect(behaviour.allIns).toBe(1);
    expect(behaviour.aggressive).toBe(1);
    // But it is in the denominator of no *rate*: aggression was never on the
    // table here, so counting it would report a choice nobody got to make.
    expect(behaviour.openable).toBe(0);
  });

  it('calls a push a gamble only when Upside is what put the chips in', () => {
    // A Hand that already clears the raising standard is a value bet that
    // happens to be for everything. Counting it as a gamble made the Rock, whose
    // appetite is zero, look like a Bot that gambles.
    // Aces: inside every personality's Opening Range, so the Rock pushes them
    // even though its appetite for a gamble is exactly zero.
    const view = viewFor({
      stack: 8,
      potTotal: 200,
      callAmount: 5,
      street: 'preflop',
      hole: 'Ah As',
    });
    const { reasons } = explainDecision(view, PERSONALITIES.Rock, 0.9, seededRng(1));
    expect(reasons.allIn).toBe(true);
    expect(reasons.wantsToRaise).toBe(true);
    expect(reasons.chosenGamble).toBe(false);
  });

  it('files an all-in under the Stack depth that produced it', () => {
    // Four big blinds behind, facing 12 into a pot of 200: even a bet sized
    // against the Stack overshoots what the Seat holds, and the clamp pushes.
    const view = viewFor({ stack: 20, potTotal: 200, callAmount: 12 });
    const tally = new BehaviourTally();
    tally.startHand();
    let pushes = 0;
    for (let seed = 0; seed < 80; seed++) {
      const { action, reasons } = explainDecision(view, PERSONALITIES.LAG, 0.95, seededRng(seed));
      tally.record('LAG', view, reasons, action.type);
      if (action.type === 'all-in') pushes += 1;
    }
    const behaviour = tally.report(1).perPersonality.find((b) => b.key === 'LAG')!;
    expect(pushes).toBeGreaterThan(0);
    expect(behaviour.byDepth['<5'].allIns).toBe(pushes);
    expect(behaviour.allInsFromShort).toBe(1);
  });
});

describe('a two-barrel bluff is counted as one story', () => {
  /** Force a bluff-driven bet on `street` by handing over a hopeless Hand. */
  const bluffOn = (tally: BehaviourTally, street: 'flop' | 'turn'): boolean => {
    const view = viewFor({ stack: 200, potTotal: 60, callAmount: 0, street });
    for (let seed = 0; seed < 400; seed++) {
      const { action, reasons } = explainDecision(view, PERSONALITIES.Bluffer, 0.02, seededRng(seed));
      if (!reasons.bluffDriven) continue;
      tally.record('Bluffer', view, reasons, action.type);
      return true;
    }
    return false;
  };

  it('needs both barrels: firing the flop alone is not a story', () => {
    const tally = new BehaviourTally();
    tally.startHand();
    expect(bluffOn(tally, 'flop')).toBe(true);
    const behaviour = tally.report(1).perPersonality.find((b) => b.key === 'Bluffer')!;
    expect(behaviour.twoBarrelsPerSession).toBe(0);
    expect(behaviour.turnAfterFlop.bluffed.reached).toBe(0);
  });

  it('counts flop-then-turn once, and remembers which Street came first', () => {
    const tally = new BehaviourTally();
    tally.startHand();
    expect(bluffOn(tally, 'flop')).toBe(true);
    expect(bluffOn(tally, 'turn')).toBe(true);
    expect(bluffOn(tally, 'turn')).toBe(true); // a third barrel is the same story

    const behaviour = tally.report(1).perPersonality.find((b) => b.key === 'Bluffer')!;
    expect(behaviour.twoBarrelsPerSession).toBe(1);
    expect(behaviour.turnAfterFlop.bluffed.reached).toBe(1);
    expect(behaviour.turnAfterFlop.bluffed.fired).toBe(1);
  });

  it('forgets the story when the Hand ends, so it cannot run across Hands', () => {
    const tally = new BehaviourTally();
    tally.startHand();
    expect(bluffOn(tally, 'flop')).toBe(true);
    tally.startHand();
    expect(bluffOn(tally, 'turn')).toBe(true);

    const behaviour = tally.report(1).perPersonality.find((b) => b.key === 'Bluffer')!;
    expect(behaviour.twoBarrelsPerSession).toBe(0);
  });
});
