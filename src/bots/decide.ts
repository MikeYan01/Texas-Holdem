// One decision, for every Bot at the table.
//
// The rule, in full (ADR-0003): work out Equity, compare it to Pot Odds — the
// share of the pot the call costs — and act on the difference. Not against a
// fixed number. When 100 is already in the middle and calling costs 2, about 2%
// Equity is enough; an absolute threshold throws that pot away, and a human
// spots that inside a few Hands.
//
// The five personalities are constants added to that one comparison. There is no
// branch on which Bot is deciding.

import type { PlayerAction } from '../engine/types.ts';
import type { BotDeps, BotView, Personality } from './types.ts';

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

/**
 * The minimum Equity that makes calling break even: what the call costs as a
 * share of the pot it is trying to win.
 */
export function potOdds(callAmount: number, potTotal: number): number {
  if (callAmount <= 0) return 0;
  return callAmount / (potTotal + callAmount);
}

/**
 * A "normal" price: the call costs a tenth of the pot. The two forms of the
 * cushion below are defined to agree exactly here.
 */
const REFERENCE_PRICE = 0.1;

/**
 * How much Equity a Bot demands before calling.
 *
 * A tight Bot wants a cushion above the bare Pot Odds, because calling now
 * commits it to the Streets that follow. But that cushion has to be
 * *proportional to the price*: a flat tax would make a Bot fold when 100 sits in
 * the middle and calling costs 2, which is the precise stupidity ADR-0003 exists
 * to prevent.
 *
 * So the cushion has two forms which agree at the reference price. Above it the
 * flat margin governs — that is where personalities are supposed to differ.
 * Below it the proportional one takes over and shrinks the cushion with the
 * price, so a nearly-free call is never thrown away. Whichever asks for less
 * wins.
 */
export function callThresholdFor(odds: number, margin: number): number {
  const flat = odds + margin;
  const proportional = odds * (1 + margin / REFERENCE_PRICE);
  return Math.min(flat, proportional);
}

/**
 * Why a Bot did what it did.
 *
 * Produced as a by-product of the decision rather than by a second pass over it,
 * so the measurement in `measure-balance.ts` reports the reasoning of the
 * decision that was actually taken. An instrumented copy of the rule would drift
 * from the real one the first time either was edited; there is no copy.
 */
export type DecisionReasons = {
  /** The Equity handed in, before this personality's misreading of it. */
  readonly trueEquity: number;
  /** What the Bot believes it holds: `trueEquity` plus this personality's noise. */
  readonly equity: number;
  readonly potOdds: number;
  readonly callThreshold: number;
  readonly raiseThreshold: number;
  /** Equity cleared the raising standard, so aggression here is a value bet. */
  readonly wantsToRaise: boolean;
  /** The bluff roll came in. Says nothing about whether aggression was legal. */
  readonly bluffing: boolean;
  readonly aggressive: boolean;
  /**
   * Chips went in because the bluff roll came in, not because Equity called for
   * it — the Player's "was that air?". Note that aggression taken instead of
   * folding is bluff-driven whatever `wantsToRaise` says: on that path the raise
   * test is never reached, so the roll is the entire reason.
   */
  readonly bluffDriven: boolean;
  /** What it wanted to raise to, before the legal range had its say. */
  readonly intendedRaiseTo: number | null;
  /** What it actually raised to, or pushed for. */
  readonly raiseTo: number | null;
  /** It wanted more than it holds, so the legal maximum decided the action. */
  readonly clampedDown: boolean;
  readonly allIn: boolean;
  /** Chips over and above the call, as a share of the pot being bet into. */
  readonly sizeFraction: number | null;
};

export type Decision = {
  readonly action: PlayerAction;
  readonly reasons: DecisionReasons;
};

export async function decide(
  view: BotView,
  personality: Personality,
  deps: BotDeps,
): Promise<PlayerAction> {
  const trueEquity = await deps.equity({
    hole: view.holeCards,
    board: view.board,
    opponentCount: view.opponentCount,
    rng: deps.rng,
  });
  return decideWithEquity(view, personality, trueEquity, deps.rng);
}

/**
 * The decision itself, given an Equity. Separated from fetching it so the
 * behaviour can be tested against exact numbers rather than against a Monte
 * Carlo run.
 */
export function decideWithEquity(
  view: BotView,
  personality: Personality,
  trueEquity: number,
  rng: BotDeps['rng'],
): PlayerAction {
  return explainDecision(view, personality, trueEquity, rng).action;
}

/**
 * The same decision, with its reasoning attached. This is the implementation;
 * `decideWithEquity` is a projection of it. Anything that wants to count what the
 * Bots are doing reads the reasons rather than guessing at them from the action,
 * because "bet" alone cannot say whether the Bot had a hand.
 */
export function explainDecision(
  view: BotView,
  personality: Personality,
  trueEquity: number,
  rng: BotDeps['rng'],
): Decision {
  const legal = view.legalActions;

  // Bots never see the real number. A Bot playing off perfect Equity calls far
  // too much and reads as a machine; the noise is a feature, not a shortfall.
  const noise = (rng() - 0.5) * 2 * personality.equityNoise;
  const equity = clamp(trueEquity + noise, 0, 1);

  const odds = potOdds(legal.callAmount, view.potTotal);
  const callMargin =
    view.street === 'preflop' ? personality.preflopCallMargin : personality.postflopCallMargin;
  const callThreshold = callThresholdFor(odds, callMargin);

  // An even share of the pot is the reference point for betting: with more than
  // your share of the Equity, betting is the profitable move.
  const evenShare = 1 / (view.opponentCount + 1);
  const raiseThreshold = evenShare + personality.raiseMargin;

  const wantsToRaise = equity >= raiseThreshold;
  // A bluff only pays when everybody folds, so its value falls away as the
  // table grows. Firing into five opponents as often as into one is the
  // difference between an aggressive style and a losing one.
  const bluffing = rng() < personality.bluffFrequency / view.opponentCount;
  // "Bet" and "raise" are the same decision to a Bot; which word the engine wants
  // depends only on whether anything has been bet yet. Checking `canBet` alone
  // would silently skip the one spot where checking and raising are both legal —
  // the big blind's option — and leave every personality checking it 100% of the
  // time.
  const canOpen = legal.canBet || legal.canRaise;

  const passive = (action: PlayerAction): Decision => ({
    action,
    reasons: {
      trueEquity,
      equity,
      potOdds: odds,
      callThreshold,
      raiseThreshold,
      wantsToRaise,
      bluffing,
      aggressive: false,
      bluffDriven: false,
      intendedRaiseTo: null,
      raiseTo: null,
      clampedDown: false,
      allIn: false,
      sizeFraction: null,
    },
  });

  const fire = (bluffDriven: boolean): Decision => {
    const sized = sizedAggression(view, personality, rng);
    return {
      action: sized.action,
      reasons: {
        trueEquity,
        equity,
        potOdds: odds,
        callThreshold,
        raiseThreshold,
        wantsToRaise,
        bluffing,
        aggressive: true,
        bluffDriven,
        intendedRaiseTo: sized.intendedRaiseTo,
        raiseTo: sized.raiseTo,
        clampedDown: sized.intendedRaiseTo > legal.maxRaiseTo,
        allIn: sized.action.type === 'all-in',
        sizeFraction:
          (sized.raiseTo - view.currentBet) / Math.max(1, view.potTotal + legal.callAmount),
      },
    };
  };

  if (legal.canCheck) {
    if ((wantsToRaise || bluffing) && canOpen) return fire(!wantsToRaise);
    return passive({ type: 'check' });
  }

  if (equity < callThreshold) {
    // Even a hand with nothing takes the pot often enough to be worth firing at
    // sometimes; this is where the Bluffer picks up pots with 7-2.
    //
    // Aggression from here is bluff-driven whatever `wantsToRaise` says, because
    // the raise test below was never reached: the roll is the entire reason
    // chips went in.
    if (bluffing && rng() < 0.5 && canOpen) return fire(true);
    return passive({ type: 'fold' });
  }

  if (wantsToRaise && canOpen) return fire(false);
  return passive(legal.canCall ? { type: 'call' } : { type: 'check' });
}

type SizedAggression = {
  readonly action: PlayerAction;
  /** Before the legal range had its say. Above `maxRaiseTo` means it overshot. */
  readonly intendedRaiseTo: number;
  /** After clamping. For a push this is the Stack, which is what went in. */
  readonly raiseTo: number;
};

/**
 * A bet or raise sized as a fraction of the pot, drawn fresh each time so the
 * table cannot be read off a single repeated number.
 */
function sizedAggression(
  view: BotView,
  personality: Personality,
  rng: BotDeps['rng'],
): SizedAggression {
  const legal = view.legalActions;
  const { min, max } = personality.betSizing;
  const fraction = min + rng() * (max - min);

  const potAfterCall = view.potTotal + legal.callAmount;
  const target = Math.round(view.currentBet + fraction * potAfterCall);
  const raiseTo = clamp(target, legal.minRaiseTo, legal.maxRaiseTo);

  // Pushing the last chip in is an all-in, and saying so makes a better table.
  if (raiseTo >= legal.maxRaiseTo && legal.canAllIn) {
    return { action: { type: 'all-in' }, intendedRaiseTo: target, raiseTo: legal.maxRaiseTo };
  }
  return {
    action: legal.canBet ? { type: 'bet', to: raiseTo } : { type: 'raise', to: raiseTo },
    intendedRaiseTo: target,
    raiseTo,
  };
}
