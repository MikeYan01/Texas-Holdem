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
import { allCanonicalLabels, canonicalHandLabel } from './starting-hands.ts';
import type { Card } from './cards.ts';

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

/** The 1326 ways to be dealt two cards, which is what a percentile is a share of. */
const TOTAL_COMBINATIONS = 1326;

/**
 * How many of those 1326 a canonical label stands for: six ways to be dealt a
 * pair, four a suited hand, twelve an offsuit one. They sum to 1326.
 */
export function combinationsFor(label: string): number {
  if (label.length === 2) return 6;
  return label[2] === 's' ? 4 : 12;
}

let ranking: ReadonlyMap<string, number> | null = null;

/**
 * The 169 starting Hands ranked strongest-first, each carrying the share of all
 * holdings it is at least as good as — so AA is the top 0.45%, and a percentile
 * of 0.15 means "inside the top 15% of Hands", which is how the phrase is meant.
 *
 * Ranked on **heads-up** Equity, which is the basis on which "the top 15% of
 * Hands" is normally said. A six-handed ranking would shift with the number of
 * opponents, and an entry standard that moved every time somebody folded would
 * not be a range at all.
 *
 * Weighted by combinations rather than by label, because that is what makes the
 * number mean what it says: AA is one of 169 labels but only 0.45% of holdings,
 * so a Bot playing "the top 5%" that treated labels as equal would be playing
 * nearly twice the Hands it claimed.
 */
function buildRanking(): ReadonlyMap<string, number> {
  const sorted = allCanonicalLabels()
    .map((label) => ({ label, equity: lookupPreflop(label, 1)?.equity ?? 0 }))
    // Ties broken by label so the ranking is stable across runs and platforms.
    .sort((a, b) => b.equity - a.equity || (a.label < b.label ? -1 : 1));

  const percentiles = new Map<string, number>();
  let cumulative = 0;
  for (const { label } of sorted) {
    cumulative += combinationsFor(label);
    percentiles.set(label, cumulative / TOTAL_COMBINATIONS);
  }
  return percentiles;
}

/**
 * Where these two cards sit among all starting Hands: the share of holdings this
 * one is at least as good as. **The strongest Hands are nearest zero**, so
 * `percentile <= 0.15` is exactly "this is in the top 15%".
 *
 * The cumulative share includes this Hand's own class, which is what makes that
 * comparison exact rather than approximate: a Bot playing the top 15% opens at
 * most 15% of holdings, never the 15.8% it would if the class straddling the cut
 * were counted as inside.
 *
 * This is the Bot's own two cards ranked against the deck, not a model of what
 * anyone else might hold — the road ADR-0003 keeps shut.
 */
export function startingHandPercentile(a: Card, b: Card): number {
  ranking ??= buildRanking();
  const label = canonicalHandLabel(a, b);
  const percentile = ranking.get(label);
  if (percentile === undefined) throw new Error(`no preflop ranking for ${label}`);
  return percentile;
}

/** The whole ranking, strongest-first. For tests and for offline inspection. */
export function startingHandRanking(): readonly { label: string; percentile: number }[] {
  ranking ??= buildRanking();
  return [...ranking].map(([label, percentile]) => ({ label, percentile }));
}

export { allCanonicalLabels, canonicalHandLabel, representativeCards } from './starting-hands.ts';
