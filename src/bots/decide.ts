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
  const bluffing = rng() < personality.bluffFrequency;
  // "Bet" and "raise" are the same decision to a Bot; which word the engine wants
  // depends only on whether anything has been bet yet. Checking `canBet` alone
  // would silently skip the one spot where checking and raising are both legal —
  // the big blind's option — and leave every personality checking it 100% of the
  // time.
  const canOpen = legal.canBet || legal.canRaise;

  if (legal.canCheck) {
    if ((wantsToRaise || bluffing) && canOpen) return sizedAggression(view, personality, rng);
    return { type: 'check' };
  }

  if (equity < callThreshold) {
    // Even a hand with nothing takes the pot often enough to be worth firing at
    // sometimes; this is where Maniac picks up pots with 7-2.
    if (bluffing && rng() < 0.5 && canOpen) return sizedAggression(view, personality, rng);
    return { type: 'fold' };
  }

  if (wantsToRaise && canOpen) return sizedAggression(view, personality, rng);
  return legal.canCall ? { type: 'call' } : { type: 'check' };
}

/**
 * A bet or raise sized as a fraction of the pot, drawn fresh each time so the
 * table cannot be read off a single repeated number.
 */
function sizedAggression(
  view: BotView,
  personality: Personality,
  rng: BotDeps['rng'],
): PlayerAction {
  const legal = view.legalActions;
  const { min, max } = personality.betSizing;
  const fraction = min + rng() * (max - min);

  const potAfterCall = view.potTotal + legal.callAmount;
  const target = Math.round(view.currentBet + fraction * potAfterCall);
  const raiseTo = clamp(target, legal.minRaiseTo, legal.maxRaiseTo);

  // Pushing the last chip in is an all-in, and saying so makes a better table.
  if (raiseTo >= legal.maxRaiseTo && legal.canAllIn) return { type: 'all-in' };
  return legal.canBet ? { type: 'bet', to: raiseTo } : { type: 'raise', to: raiseTo };
}
