// Equity: "what are my chances of winning this pot?"
//
// Three methods by Street, not one (ADR-0005), because the right method changes
// as the sample space does:
//
//   * Preflop — a lookup. 169 canonical starting hands by opponent count, worked
//     out once offline by this repository's own evaluator. Free at the table.
//   * Flop and turn — Monte Carlo, 2000 iterations, about ±1.2% (1σ). More
//     precision is not worth buying: the error falls as 1/√n, so ±0.15% costs a
//     hundred times the work, and the Bots cannot consume that anyway — their
//     thresholds carry a personality offset and their own noise on top.
//   * River — enumeration, where the space is small enough that counting is both
//     faster and exact. (The spec quotes C(44,2) = 946 possible opponent hands;
//     that is off by one card. Seven are known, so 45 are unknown and the real
//     figure is C(45,2) = 990. We enumerate all 990.)
//
// The interface is async even though the work happens on the main thread. That is
// deliberate: 7 ms for five Bots sits well inside a frame, so a Web Worker would
// buy a serialisation boundary for a problem that does not exist — but the
// `await` at every call site means moving it later is one file, not a refactor.

import type { Card } from './cards.ts';
import type { Rng } from './rng.ts';
import {
  DEFAULT_ITERATIONS,
  enumerateRiverHeadsUp,
  monteCarloEquity,
  type EquityMethod,
  type EquityResult,
} from './equity-core.ts';
import { PREFLOP_EQUITY } from './preflop-equity.ts';
import { canonicalHandLabel } from './starting-hands.ts';

export { DEFAULT_ITERATIONS };
export type { EquityMethod, EquityResult };

export type EquityRequest = {
  readonly hole: readonly [Card, Card];
  /** 0, 3, 4 or 5 community cards. */
  readonly board: readonly Card[];
  readonly opponentCount: number;
  readonly rng: Rng;
  /** Ignored by the lookup and the enumeration, neither of which samples. */
  readonly iterations?: number;
};

/**
 * The asynchronous entry point — the one every consumer should use. Everything
 * below it is synchronous; the promise is there to fix the shape of the call
 * site so the implementation can move without touching them.
 */
export async function getEquity(request: EquityRequest): Promise<EquityResult> {
  return computeEquity(request);
}

/** The same answer without the promise, for tests and the offline generator. */
export function computeEquity(request: EquityRequest): EquityResult {
  const { hole, board, opponentCount } = request;
  if (opponentCount < 1) throw new Error('equity needs at least one opponent');
  if (board.length === 0) return preflopLookup(hole, opponentCount);
  if (board.length === 5 && opponentCount === 1) return enumerateRiverHeadsUp(hole, board);
  return monteCarloEquity(request);
}

function preflopLookup(hole: readonly [Card, Card], opponentCount: number): EquityResult {
  const label = canonicalHandLabel(hole[0], hole[1]);
  const row = PREFLOP_EQUITY.table[label];
  const equity = row?.[opponentCount - 1];
  if (equity === undefined) {
    throw new Error(`no preflop entry for ${label} against ${opponentCount} opponent(s)`);
  }
  return {
    equity,
    win: equity,
    tie: 0,
    method: 'preflop-table',
    samples: PREFLOP_EQUITY.iterations,
  };
}
