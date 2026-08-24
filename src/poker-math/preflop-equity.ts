// The precomputed preflop Equity table.
//
// Every number in `preflop-equity-table.json` was computed by this repository,
// by `scripts/generate-preflop-table.ts`, using this repository's own evaluator —
// the one verified against all 133,784,560 seven-card hands. None of it is
// transcribed from a published table: the well-known ones come out of
// copyrighted books, and several repositories carrying that data ship no licence
// at all. Since the evaluator is already trustworthy, generating our own numbers
// is a one-off script rather than a legal question.
//
// ADR-0005 calls the preflop tier "exact". Read that as "not sampled at the
// table": each cell rests on 200,000 seeded iterations run once, offline, so the
// number costs nothing at the table and is identical on every call — but it does
// carry about 0.11% of sampling error, and the file's own metadata says so.
// Enumerating one cell means 2.1e9 showdowns, which is why it is sampled.

// The import attribute is not decoration: without it this module only loads
// through a bundler, and the engine side is meant to run anywhere a plain
// JavaScript runtime does.
import table from './preflop-equity-table.json' with { type: 'json' };

/** What one cell of the table says. */
export type PreflopCell = {
  /** Share of the pot won on average: `win + tie / 2`. */
  readonly equity: number;
  /** How often the hand wins outright. */
  readonly win: number;
  /** How often it splits. */
  readonly tie: number;
};

export type PreflopTable = {
  readonly generatedBy: string;
  readonly method: string;
  /** Iterations behind each cell, and therefore how precise these numbers are. */
  readonly iterations: number;
  readonly seed: number;
  /** The largest opponent count covered; index 0 of a row is one opponent. */
  readonly maxOpponents: number;
  readonly cellFormat: string;
  readonly note: string;
  /** Label to `[equity, win, tie]` by opponent count. */
  readonly table: Readonly<Record<string, readonly (readonly number[])[]>>;
};

export const PREFLOP_EQUITY: PreflopTable = table;

/**
 * One cell, or `undefined` where the table does not reach — either a label it
 * does not know or more opponents than it was generated for. Callers decide
 * which of those is a bug and which is a reason to fall back to sampling.
 */
export function lookupPreflop(label: string, opponentCount: number): PreflopCell | undefined {
  const cell = PREFLOP_EQUITY.table[label]?.[opponentCount - 1];
  if (cell === undefined) return undefined;
  const [equity, win, tie] = cell;
  if (equity === undefined || win === undefined || tie === undefined) return undefined;
  return { equity, win, tie };
}

export { allCanonicalLabels, canonicalHandLabel, representativeCards } from './starting-hands.ts';
