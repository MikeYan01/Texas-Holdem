import { describe, expect, it } from 'vitest';
import { parseCards } from './cards.ts';
import {
  allCanonicalLabels,
  combinationsFor,
  lookupPreflop,
  representativeCards,
  startingHandPercentile,
  startingHandRanking,
} from './preflop-equity.ts';

/** The two cards a label stands for, as the ranking sees them. */
const cardsFor = (hand: string): [number, number] => {
  const [a, b] = parseCards(hand);
  return [a!, b!];
};

describe('the starting-hand ranking', () => {
  it('covers all 169 canonical Hands, and all 1326 holdings', () => {
    const ranking = startingHandRanking();
    expect(ranking).toHaveLength(169);
    const total = ranking.reduce((sum, entry) => sum + combinationsFor(entry.label), 0);
    expect(total).toBe(1326);
  });

  it('puts the strongest Hands nearest zero and the worst at one', () => {
    // AA is the top 0.45% of holdings: six of 1326.
    expect(startingHandPercentile(...cardsFor('Ah As'))).toBeCloseTo(6 / 1326, 9);
    // The weakest Hand closes the ranking, so the last percentile is exactly 1.
    const ranking = startingHandRanking();
    expect(ranking[ranking.length - 1]!.percentile).toBeCloseTo(1, 9);
  });

  it('agrees with the ordering of the Equity table it is built from', () => {
    const ranking = startingHandRanking();
    for (let i = 1; i < ranking.length; i++) {
      const before = lookupPreflop(ranking[i - 1]!.label, 1)!.equity;
      const after = lookupPreflop(ranking[i]!.label, 1)!.equity;
      expect(before, `${ranking[i - 1]!.label} before ${ranking[i]!.label}`).toBeGreaterThanOrEqual(
        after,
      );
    }
  });

  it('ranks the Hands a Player would expect where a Player would expect them', () => {
    const percentile = (hand: string) => startingHandPercentile(...cardsFor(hand));
    expect(percentile('Ah As')).toBeLessThan(percentile('Kh Ks'));
    expect(percentile('Kh Ks')).toBeLessThan(percentile('Ah Kh'));
    // Suited beats the same cards offsuit, always.
    expect(percentile('Ah Kh')).toBeLessThan(percentile('Ah Kd'));
    expect(percentile('7h 2d')).toBeGreaterThan(0.95);
    // A pocket pair of deuces still beats most unpaired Hands.
    expect(percentile('2h 2d')).toBeLessThan(0.5);
  });

  it('is the same number for any two cards of the same class', () => {
    // Preflop Equity depends on the ranks and on suitedness, and nothing else.
    expect(startingHandPercentile(...cardsFor('Ah Kh'))).toBe(
      startingHandPercentile(...cardsFor('Ac Kc')),
    );
    expect(startingHandPercentile(...cardsFor('9s 4d'))).toBe(
      startingHandPercentile(...cardsFor('9c 4h')),
    );
  });

  it('makes "the top X%" mean exactly that, never more', () => {
    // The cumulative share includes this Hand's own class, so the class that
    // straddles the cut falls outside it. Without that, a Bot playing "the top
    // 20%" would open 20.8% of holdings.
    for (const share of [0.02, 0.05, 0.1, 0.15, 0.2, 0.35, 0.5]) {
      let opened = 0;
      for (const label of allCanonicalLabels()) {
        const [a, b] = representativeCards(label);
        if (startingHandPercentile(a, b) <= share) opened += combinationsFor(label);
      }
      expect(opened / 1326, `top ${share}`).toBeLessThanOrEqual(share);
    }
  });
});
