// The precomputed preflop Equity table.
//
// Every number in `preflop-equity-table.json` was computed by this repository,
// by `scripts/generate-preflop-table.ts`, using this repository's own evaluator —
// the one verified against all 133,784,560 seven-card hands. None of it is
// transcribed from a published table: the well-known ones come out of
// copyrighted books, and several repositories carrying that data ship no licence
// at all. Since the evaluator is already trustworthy, generating our own numbers
// is a one-off script rather than a legal question.

import table from './preflop-equity-table.json';

export type PreflopTable = {
  /** Iterations behind each cell, and therefore how precise these numbers are. */
  readonly iterations: number;
  readonly seed: number;
  readonly maxOpponents: number;
  readonly note: string;
  /** Label to Equity by opponent count; index 0 is one opponent. */
  readonly table: Readonly<Record<string, readonly number[]>>;
};

export const PREFLOP_EQUITY: PreflopTable = table;

export { allCanonicalLabels, canonicalHandLabel, representativeCards } from './starting-hands.ts';
