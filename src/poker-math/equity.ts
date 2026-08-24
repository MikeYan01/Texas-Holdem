// Equity: "what are my chances of winning this pot?"
//
// One number, defined once and used everywhere: `win + tie / 2`, the share of the
// pot this hand takes on average against that many uniformly random opponent
// holdings, in [0, 1]. Not "how often do I win" — a chop is half a pot, and a
// hand that always chops is worth 0.5, not 0.
//
// Three methods by Street, not one (ADR-0005), because the right method changes
// as the sample space does:
//
//   * Preflop — a lookup. 169 canonical starting hands by opponent count, worked
//     out once offline by this repository's own evaluator. Free at the table, and
//     the same number every time; sampled offline at 200k per cell, so precise to
//     about 0.11% rather than to the last decimal.
//   * Flop and turn — Monte Carlo, 2000 iterations, about ±1.2% (1σ). More
//     precision is not worth buying: the error falls as 1/√n, so ±0.15% costs a
//     hundred times the work, and the Bots cannot consume that anyway — their
//     thresholds carry a personality offset and their own noise on top.
//   * River — enumeration, where the space is small enough that counting is both
//     faster and exact. (The spec quotes C(44,2) = 946 possible opponent hands;
//     that is off by one card. Seven are known, so 45 are unknown and the real
//     figure is C(45,2) = 990. We enumerate all 990.) Heads-up only: several
//     opponents jointly is 990^n, so that case samples and says so.
//
// `method` on the result always says which of the three actually ran, including
// when a request falls off the edge of the lookup or of what can be enumerated.
//
// The interface is async even though the work happens on the main thread. That is
// deliberate: 7 ms for five Bots sits well inside a frame, so a Web Worker would
// buy a serialisation boundary for a problem that does not exist — but the
// `await` at every call site means moving it later is one file, not a refactor.

import { DECK_SIZE, formatCard, type Card } from './cards.ts';
import type { Rng } from './rng.ts';
import {
  DEFAULT_ITERATIONS,
  enumerateRiverHeadsUp,
  monteCarloEquity,
  type EquityMethod,
  type EquityResult,
} from './equity-core.ts';
import { PREFLOP_EQUITY, lookupPreflop } from './preflop-equity.ts';
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
  validate(request);
  const { hole, board, opponentCount } = request;
  if (board.length === 0) return preflop(request);
  if (board.length === 5 && opponentCount === 1) return enumerateRiverHeadsUp(hole, board);
  return monteCarloEquity(request);
}

/**
 * Reject what cannot be answered, rather than answering it wrongly. Without this
 * a duplicated card silently shortens the deck and the loop reads past the end of
 * it, which produces a number that looks perfectly reasonable and is not.
 */
function validate(request: EquityRequest): void {
  const { hole, board, opponentCount } = request;
  if (!Number.isInteger(opponentCount) || opponentCount < 1) {
    throw new Error('equity needs at least one opponent');
  }
  const size = board.length;
  if (size !== 0 && size !== 3 && size !== 4 && size !== 5) {
    throw new Error(`a board holds 0, 3, 4 or 5 cards, not ${size}`);
  }
  const seen = new Uint8Array(DECK_SIZE);
  const mark = (card: Card): void => {
    if (!Number.isInteger(card) || card < 0 || card >= DECK_SIZE) {
      throw new Error(`not a card: ${card}`);
    }
    if (seen[card] === 1) throw new Error(`${formatCard(card)} appears twice`);
    seen[card] = 1;
  };
  mark(hole[0]);
  mark(hole[1]);
  for (const card of board) mark(card);
}

/**
 * The lookup. `win` and `tie` come out of the table too, rather than being
 * invented from the equity: the table stores all three because a caller shown
 * "85%" deserves to know it is 84.8% outright and 0.5% split, and because
 * claiming `tie: 0` for a hand that does split would simply be untrue.
 */
function preflop(request: EquityRequest): EquityResult {
  const { hole, opponentCount } = request;
  // Six seats is the table's whole world, so five opponents is the most it was
  // generated for. A larger game is not an error, it is just past the edge of the
  // lookup — sample it and say so in `method` rather than throwing or lying.
  if (opponentCount > PREFLOP_EQUITY.maxOpponents) return monteCarloEquity(request);

  const label = canonicalHandLabel(hole[0], hole[1]);
  const cell = lookupPreflop(label, opponentCount);
  if (cell === undefined) {
    throw new Error(`no preflop entry for ${label} against ${opponentCount} opponent(s)`);
  }
  return {
    equity: cell.equity,
    win: cell.win,
    tie: cell.tie,
    method: 'preflop-table',
    samples: PREFLOP_EQUITY.iterations,
  };
}
