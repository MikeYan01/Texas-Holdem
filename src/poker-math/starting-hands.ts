// The 169 canonical starting hands.
//
// Before the flop only three things about your two cards matter: the two ranks
// and whether they share a suit. That collapses 1326 possible holdings to 169,
// which is small enough to precompute exactly — and is the whole reason the
// preflop tier of ADR-0005 is a lookup rather than a simulation.
//
// Kept separate from the table itself so the offline generator can use it before
// the file it generates exists.

import { RANK_SYMBOLS, rankOf, suitOf, type Card } from './cards.ts';

/** `AA`, `AKs`, `72o`. */
export function canonicalHandLabel(a: Card, b: Card): string {
  const first = rankOf(a);
  const second = rankOf(b);
  const high = RANK_SYMBOLS[Math.max(first, second)]!;
  const low = RANK_SYMBOLS[Math.min(first, second)]!;
  if (first === second) return `${high}${low}`;
  return `${high}${low}${suitOf(a) === suitOf(b) ? 's' : 'o'}`;
}

/** All 169 labels in a fixed order, so the generator's output is stable. */
export function allCanonicalLabels(): string[] {
  const labels: string[] = [];
  for (let high = RANK_SYMBOLS.length - 1; high >= 0; high--) {
    for (let low = high; low >= 0; low--) {
      if (high === low) {
        labels.push(`${RANK_SYMBOLS[high]}${RANK_SYMBOLS[low]}`);
      } else {
        labels.push(
          `${RANK_SYMBOLS[high]}${RANK_SYMBOLS[low]}s`,
          `${RANK_SYMBOLS[high]}${RANK_SYMBOLS[low]}o`,
        );
      }
    }
  }
  return labels;
}

/**
 * A representative holding for a label. Any two cards with the same ranks and
 * suitedness have identical Equity before the flop, so one representative stands
 * for the whole class.
 */
export function representativeCards(label: string): [Card, Card] {
  const high = RANK_SYMBOLS.indexOf(label[0] as (typeof RANK_SYMBOLS)[number]);
  const low = RANK_SYMBOLS.indexOf(label[1] as (typeof RANK_SYMBOLS)[number]);
  if (high < 0 || low < 0) throw new Error(`bad label: ${label}`);
  if (label.length === 2) return [high * 4, low * 4 + 1];
  return [high * 4, low * 4 + (label[2] === 's' ? 0 : 1)];
}
