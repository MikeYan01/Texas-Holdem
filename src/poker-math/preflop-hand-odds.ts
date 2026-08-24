// The precomputed preflop hand-category table.
//
// Exhaustive, not sampled: `scripts/generate-preflop-hand-odds.ts` enumerates
// every one of the C(50,5) = 2,118,760 boards for each of the 169 canonical
// starting hands, using this repository's own evaluator. Counts are stored rather
// than probabilities so the data is exactly right and the total is checkable.

import table from './preflop-hand-odds-table.json';

export type PreflopHandOddsTable = {
  readonly method: string;
  /** C(50,5). Every entry's counts sum to exactly this. */
  readonly boardsPerHand: number;
  readonly note: string;
  /** Label to counts by hand category 0..8. */
  readonly table: Readonly<Record<string, readonly number[]>>;
};

export const PREFLOP_HAND_ODDS: PreflopHandOddsTable = table;
