// A random legal action, for property testing.
//
// The engine's headline invariant — six Scores summing to zero, always — is
// verified by playing a very large number of Hands with arbitrary legal play. To
// do that, something has to be able to pick an arbitrary legal action, and it has
// to be seeded so a failure can be replayed. That is all this is.
//
// It lives beside the engine rather than in a test file because the Bot tests
// reuse it: "every action a Bot returns is one the engine accepts" is only
// meaningful when compared against the same notion of legal.

import type { Rng } from '../poker-math/rng.ts';
import type { LegalActions, PlayerAction } from './types.ts';

/** Every action that is legal right now, with a spread of raise sizes. */
export function enumerateLegalActions(legal: LegalActions): PlayerAction[] {
  const actions: PlayerAction[] = [];
  if (legal.canFold) actions.push({ type: 'fold' });
  if (legal.canCheck) actions.push({ type: 'check' });
  if (legal.canCall) actions.push({ type: 'call' });

  const kind = legal.canBet ? 'bet' : 'raise';
  if (legal.canBet || legal.canRaise) {
    const sizes = new Set([
      legal.minRaiseTo,
      legal.presets.halfPot,
      legal.presets.pot,
      legal.maxRaiseTo,
    ]);
    for (const to of sizes) actions.push({ type: kind, to });
  }
  if (legal.allInTo > 0 && legal.canAllIn) actions.push({ type: 'all-in' });
  return actions;
}

/**
 * A weighted pick that folds far less often than uniform choice would. Uniform
 * play folds most Hands before the flop, which would leave the later Streets —
 * where side pots live — barely exercised.
 */
export function weightedLegalAction(legal: LegalActions, rng: Rng): PlayerAction {
  const roll = rng();
  if (legal.canCheck && roll < 0.55) return { type: 'check' };
  if (legal.canCall && roll < 0.55) return { type: 'call' };
  if (roll < 0.7 && legal.canFold) return { type: 'fold' };
  if (roll < 0.93 && (legal.canBet || legal.canRaise)) {
    const span = legal.maxRaiseTo - legal.minRaiseTo;
    const to = legal.minRaiseTo + Math.floor(rng() * (span + 1));
    return { type: legal.canBet ? 'bet' : 'raise', to };
  }
  if (legal.allInTo > 0 && legal.canAllIn && roll < 0.97) return { type: 'all-in' };
  if (legal.canCheck) return { type: 'check' };
  if (legal.canCall) return { type: 'call' };
  return { type: 'fold' };
}
