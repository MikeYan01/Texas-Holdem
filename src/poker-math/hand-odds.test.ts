import { describe, expect, it } from 'vitest';
import { parseCards, type Card } from './cards.ts';
import { HandCategory } from './evaluate-hand.ts';
import { handOdds, likeliestCategories, madeCategoryNow } from './hand-odds.ts';
import { PREFLOP_HAND_ODDS } from './preflop-hand-odds.ts';
import { allCanonicalLabels } from './starting-hands.ts';

const hole = (text: string): [Card, Card] => {
  const cards = parseCards(text);
  return [cards[0]!, cards[1]!];
};
const odds = (holeText: string, board = '') => handOdds(hole(holeText), parseCards(board));

describe('the preflop hand-odds table', () => {
  it('is exhaustive rather than sampled', () => {
    expect(PREFLOP_HAND_ODDS.method).toBe('exhaustive-enumeration');
    expect(PREFLOP_HAND_ODDS.boardsPerHand).toBe(2_118_760); // C(50,5)
    expect(PREFLOP_HAND_ODDS.note).toContain('No published or copyrighted');
  });

  it('accounts for every board, for every one of the 169 starting hands', () => {
    const labels = allCanonicalLabels();
    expect(Object.keys(PREFLOP_HAND_ODDS.table)).toHaveLength(169);
    for (const label of labels) {
      const counts = PREFLOP_HAND_ODDS.table[label];
      expect(counts, label).toHaveLength(9);
      const total = counts!.reduce((sum, count) => sum + count, 0);
      expect(total, label).toBe(PREFLOP_HAND_ODDS.boardsPerHand);
      for (const count of counts!) expect(Number.isInteger(count)).toBe(true);
    }
  });

  it('averages out to the published seven-card frequencies over the whole deck', () => {
    // The strongest check available: weight every canonical hand by how often it
    // is dealt (6 combinations for a pair, 4 suited, 12 offsuit) and the table
    // has to reproduce the frequencies of a random seven-card hand exactly. No
    // single cell could be wrong without showing up here.
    const totals = new Array(9).fill(0);
    let weight = 0;
    for (const label of allCanonicalLabels()) {
      const combos = label.length === 2 ? 6 : label[2] === 's' ? 4 : 12;
      weight += combos;
      PREFLOP_HAND_ODDS.table[label]!.forEach((count, category) => {
        totals[category] += (count / PREFLOP_HAND_ODDS.boardsPerHand) * combos;
      });
    }
    expect(weight).toBe(1326);

    const published = [17.4119, 43.8225, 23.4955, 4.8290, 4.6194, 3.0255, 2.5961, 0.1681, 0.0311];
    for (let category = 0; category < 9; category++) {
      expect((totals[category] / weight) * 100, `category ${category}`).toBeCloseTo(
        published[category]!,
        2,
      );
    }
  });

  it('says the obvious things about starting hands', () => {
    const p = (label: string, category: HandCategory) =>
      PREFLOP_HAND_ODDS.table[label]![category]! / PREFLOP_HAND_ODDS.boardsPerHand;

    // A pocket pair can never finish with high card, and makes trips and full
    // houses far more often than two unpaired cards do.
    expect(p('AA', HandCategory.HighCard)).toBe(0);
    expect(p('AA', HandCategory.Trips)).toBeGreaterThan(p('AKo', HandCategory.Trips));
    expect(p('AA', HandCategory.FullHouse)).toBeGreaterThan(p('AKo', HandCategory.FullHouse));

    // Suited makes flushes far more often; connected makes straights far more often.
    expect(p('AKs', HandCategory.Flush)).toBeGreaterThan(3 * p('AKo', HandCategory.Flush));
    expect(p('JTs', HandCategory.Straight)).toBeGreaterThan(2 * p('J2s', HandCategory.Straight));

    // And suited connectors are the best of both, which is why people play them.
    expect(p('JTs', HandCategory.StraightFlush)).toBeGreaterThan(p('J2s', HandCategory.StraightFlush));
  });
});

describe('handOdds picks a method by how much is left to come', () => {
  it('looks up preflop rather than enumerating two million boards on a keypress', () => {
    const result = odds('Ah Kh');
    expect(result.method).toBe('preflop-table');
    expect(result.cardsToCome).toBe(5);
    expect(result.runOuts).toBe(2_118_760);
  });

  it('enumerates all 1,081 run-outs on the flop', () => {
    const result = odds('Ah Kh', '2c 7d 9s');
    expect(result.method).toBe('exact-enumeration');
    expect(result.cardsToCome).toBe(2);
    expect(result.runOuts).toBe(1081); // C(47,2)
  });

  it('enumerates all 46 rivers on the turn', () => {
    const result = odds('Ah Kh', '2c 7d 9s Kd');
    expect(result.runOuts).toBe(46);
    expect(result.cardsToCome).toBe(1);
  });

  it('is a certainty on the river, where the hand is already made', () => {
    const result = odds('Ah Kh', 'Qh Jh Th 2c 3d');
    expect(result.runOuts).toBe(1);
    expect(result.cardsToCome).toBe(0);
    expect(result.probabilities[HandCategory.StraightFlush]).toBe(1);
    expect(likeliestCategories(result, 5)).toEqual([
      { category: HandCategory.StraightFlush, probability: 1 },
    ]);
  });

  it('always adds up to one', () => {
    const boards = ['', '2c 7d 9s', '2c 7d 9s Kd', '2c 7d 9s Kd 4h'];
    for (const board of boards) {
      const total = odds('Ah Kh', board).probabilities.reduce((sum, p) => sum + p, 0);
      expect(total).toBeCloseTo(1, 10);
    }
  });

  it('needs no randomness at all, so it never wobbles', () => {
    expect(odds('Ah Kh', '2c 7d 9s')).toEqual(odds('Ah Kh', '2c 7d 9s'));
  });
});

describe('a turn position countable by hand', () => {
  // Aces on 2♣ 7♦ 9♠ K♠. Forty-six cards can come:
  //   2 aces          -> trips
  //   12 board pairs  -> two pair (four ranks, three of each left)
  //   32 blanks       -> still one pair
  // No straight or flush is reachable, so those must all be exactly zero.
  const position = ['Ah Ad', '2c 7d 9s Ks'] as const;

  it('matches the count exactly', () => {
    const result = odds(...position);
    expect(result.runOuts).toBe(46);
    expect(result.probabilities[HandCategory.Trips]).toBeCloseTo(2 / 46, 12);
    expect(result.probabilities[HandCategory.TwoPair]).toBeCloseTo(12 / 46, 12);
    expect(result.probabilities[HandCategory.Pair]).toBeCloseTo(32 / 46, 12);
  });

  it('reports zero for what cannot happen', () => {
    const result = odds(...position);
    for (const category of [
      HandCategory.HighCard,
      HandCategory.Straight,
      HandCategory.Flush,
      HandCategory.FullHouse,
      HandCategory.Quads,
      HandCategory.StraightFlush,
    ]) {
      expect(result.probabilities[category], `category ${category}`).toBe(0);
    }
  });
});

describe('playing the board', () => {
  it('counts a flush the Seat does not hold a card of', () => {
    // Trip aces, but three clubs are out there. Two more clubs and the best five
    // cards are the board's flush, not the trips.
    const result = odds('Ah Ad', 'Ac Kc Qc');
    expect(result.probabilities[HandCategory.Flush]).toBeGreaterThan(0);
    expect(result.probabilities[HandCategory.Trips]).toBeGreaterThan(0);
    expect(result.probabilities[HandCategory.HighCard]).toBe(0);
    expect(result.probabilities[HandCategory.Pair]).toBe(0);
  });
});

describe('likeliestCategories', () => {
  it('returns the most likely first, at most as many as asked for', () => {
    const top = likeliestCategories(odds('Ah Kh'), 5);
    expect(top).toHaveLength(5);
    for (let i = 1; i < top.length; i++) {
      expect(top[i]!.probability).toBeLessThanOrEqual(top[i - 1]!.probability);
    }
    expect(top[0]!.category).toBe(HandCategory.Pair); // one pair is the usual result
  });

  it('drops categories that cannot happen rather than listing them at zero', () => {
    const top = likeliestCategories(odds('Ah Ad', '2c 7d 9s Ks'), 5);
    expect(top.map((entry) => entry.category)).toEqual([
      HandCategory.Pair,
      HandCategory.TwoPair,
      HandCategory.Trips,
    ]);
  });

  it('breaks ties towards the stronger hand', () => {
    const tied = {
      probabilities: [0.5, 0, 0, 0, 0, 0, 0, 0.25, 0.25],
      method: 'exact-enumeration',
      runOuts: 4,
      cardsToCome: 1,
    } as const;
    expect(likeliestCategories(tied, 3).map((e) => e.category)).toEqual([
      HandCategory.HighCard,
      HandCategory.StraightFlush,
      HandCategory.Quads,
    ]);
  });
});

describe('madeCategoryNow', () => {
  it('says what is held right now, once there is a board to hold it against', () => {
    expect(madeCategoryNow(hole('Ah Ad'), parseCards('2c 7d 9s'))).toBe(HandCategory.Pair);
    expect(madeCategoryNow(hole('Ah Ad'), parseCards('Ac 7d 9s'))).toBe(HandCategory.Trips);
    expect(madeCategoryNow(hole('Ah Kh'), parseCards('Qh Jh Th'))).toBe(HandCategory.StraightFlush);
  });

  it('says nothing before the flop, when there is no hand yet', () => {
    expect(madeCategoryNow(hole('Ah Ad'), [])).toBeNull();
  });
});

describe('performance', () => {
  it('answers fast enough to compute during a render', () => {
    const heroHole = hole('Ah Kh');
    const board = parseCards('2c 7d 9s');
    for (let i = 0; i < 20; i++) handOdds(heroHole, board); // warm up

    const started = globalThis.performance.now();
    for (let i = 0; i < 100; i++) handOdds(heroHole, board);
    const each = (globalThis.performance.now() - started) / 100;
    // The flop is the worst case at 1,081 evaluations. This is why the interface
    // is synchronous while Equity's is not.
    expect(each).toBeLessThan(20);
  });
});
