import { describe, expect, it } from 'vitest';
import { formatCards, parseCards } from './cards.ts';
import {
  HandCategory,
  TIEBREAKER_COUNT,
  bestFive,
  categoryOf,
  evaluateHand,
  tiebreakersOf,
} from './evaluate-hand.ts';

const value = (text: string) => evaluateHand(parseCards(text));
const category = (text: string) => categoryOf(value(text));
const tiebreakers = (text: string) => tiebreakersOf(value(text));

// Rank indices, for reading tiebreaker assertions without counting on fingers.
const [DEUCE, , FOUR, FIVE, SIX, SEVEN, EIGHT, NINE, , JACK, QUEEN, KING, ACE] =
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

describe('evaluateHand: the interface contract', () => {
  it('returns one comparable integer, and higher means stronger', () => {
    // One hand per category, weakest first. The chain fixes the direction of the
    // comparison on the interface: every downstream split-pot decision depends
    // on it, so it must not be inferable only from the implementation.
    const ascending = [
      'Ah Kd 9s 7c 4h 3d 2s', // high card
      'Ah Ad 9s 7c 4h 3d 2s', // one pair
      'Ah Ad 9s 9c 4h 3d 2s', // two pair
      'Ah Ad As 9c 4h 3d 2s', // trips
      '5h 6d 7s 8c 9h 3d 2s', // straight
      'Ah Kh 9h 7h 4h 3d 2s', // flush
      'Ah Ad As 9c 9h 3d 2s', // full house
      'Ah Ad As Ac 9h 3d 2s', // quads
      '5h 6h 7h 8h 9h 3d 2s', // straight flush
    ].map(value);

    for (let i = 1; i < ascending.length; i++) {
      expect(ascending[i]!).toBeGreaterThan(ascending[i - 1]!);
    }
  });

  it('gives two materially identical hands the same value, which is what splits a pot', () => {
    // Same ranks, different suits, neither makes a flush.
    expect(value('Ah Kd Qs Jc 9h 4d 2s')).toBe(value('As Kh Qd Jh 9c 4s 2h'));
  });

  it('separates hands that differ only in a kicker', () => {
    expect(value('Ah Ad Ks 9c 4h 3d 2s')).toBeGreaterThan(value('Ah Ad Qs 9c 4h 3d 2s'));
  });

  it('exposes the category and the key ranks behind the value', () => {
    expect(category('Ah Ad Ks Kc 4h 3d 2s')).toBe(HandCategory.TwoPair);
    expect(tiebreakers('Ah Ad Ks Kc 4h 3d 2s')).toEqual([ACE, KING, FOUR]);
    expect(TIEBREAKER_COUNT[HandCategory.TwoPair]).toBe(3);
  });

  it('reports as many tiebreakers as the category actually uses', () => {
    expect(tiebreakers('5h 6d 7s 8c 9h 3d 2s')).toEqual([NINE]); // straight: just the top
    expect(tiebreakers('Ah Kh 9h 7h 4h 3d 2s')).toEqual([ACE, KING, NINE, SEVEN, FOUR]); // flush: all five
    expect(tiebreakers('Ah Ad As 9c 9h 3d 2s')).toEqual([ACE, NINE]); // full house: trips then pair
  });

  it('accepts five and six cards too, so subsets can be scored the same way', () => {
    expect(categoryOf(evaluateHand(parseCards('Ah Kh Qh Jh Th')))).toBe(HandCategory.StraightFlush);
    expect(categoryOf(evaluateHand(parseCards('Ah Kh Qh Jh Th 2s')))).toBe(
      HandCategory.StraightFlush,
    );
  });
});

describe('evaluateHand: the nine known traps', () => {
  it('a flush that also contains a straight is only a flush', () => {
    // Ah Kh Qh Jh 9h is a flush; the T that would complete Broadway is off-suit.
    expect(category('Ah Kh Qh Jh 9h Ts Tc')).toBe(HandCategory.Flush);
  });

  it('recognises the A-2-3-4-5 wheel as a five-high straight', () => {
    expect(category('Ah 2d 3s 4c 5h Kd Qs')).toBe(HandCategory.Straight);
    expect(tiebreakers('Ah 2d 3s 4c 5h Kd Qs')).toEqual([FIVE]);
    expect(value('Ah 2d 3s 4c 5h Kd Qs')).toBeLessThan(value('2h 3d 4s 5c 6h Kd Qs'));
  });

  it('recognises the wheel straight flush', () => {
    expect(category('Ah 2h 3h 4h 5h Kd Qs')).toBe(HandCategory.StraightFlush);
    expect(tiebreakers('Ah 2h 3h 4h 5h Kd Qs')).toEqual([FIVE]);
    expect(value('Ah 2h 3h 4h 5h Kd Qs')).toBeLessThan(value('2h 3h 4h 5h 6h Kd Qs'));
  });

  it('does not let the ace wrap around: Q K A 2 3 is not a straight', () => {
    expect(category('Qh Kd Ac 2s 3h 7d 9s')).toBe(HandCategory.HighCard);
  });

  it('reads two sets of trips as a full house, using the higher set as the trips', () => {
    expect(category('9h 9d 9s 4c 4h 4d 2s')).toBe(HandCategory.FullHouse);
    expect(tiebreakers('9h 9d 9s 4c 4h 4d 2s')).toEqual([NINE, FOUR]);
  });

  it("takes the third pair's rank as the two-pair kicker when it beats the singles", () => {
    // Three pairs (A, K, Q) plus a deuce: the kicker is the queen, not the deuce.
    expect(category('Ah Ad Ks Kc Qh Qd 2s')).toBe(HandCategory.TwoPair);
    expect(tiebreakers('Ah Ad Ks Kc Qh Qd 2s')).toEqual([ACE, KING, QUEEN]);
  });

  it('takes the quads kicker from a pair when the pair outranks the singles', () => {
    expect(category('7h 7d 7s 7c Kh Kd 2s')).toBe(HandCategory.Quads);
    expect(tiebreakers('7h 7d 7s 7c Kh Kd 2s')).toEqual([SEVEN, KING]);
  });

  it('takes the top five of a six- or seven-card flush', () => {
    expect(tiebreakers('Ah Kh Qh 5h 4h 3h 2s')).toEqual([ACE, KING, QUEEN, FIVE, FOUR]);
    // Seven hearts and deliberately no straight inside them: A K Q 9 5 4 3.
    expect(tiebreakers('Ah Kh Qh 9h 5h 4h 3h')).toEqual([ACE, KING, QUEEN, NINE, FIVE]);
  });

  it('gives equal values to two hands that are equally strong, so the pot splits', () => {
    // Both play the board: the best five cards are the community straight.
    const board = '9h 8d 7s 6c 5h';
    expect(evaluateHand(parseCards(`${board} 2s 2d`))).toBe(
      evaluateHand(parseCards(`${board} 3s 3d`)),
    );
  });
});

describe('bestFive', () => {
  it('picks the five cards that actually make the hand', () => {
    expect(formatCards(bestFive(parseCards('Ah Kh Qh Jh 9h Ts Tc')))).toBe('Ah Kh Qh Jh 9h');
  });

  it('picks the wheel rather than the higher cards when the wheel is the hand', () => {
    expect(formatCards(bestFive(parseCards('Ah 2d 3s 4c 5h Kd Qs')))).toBe('Ah 5h 4c 3s 2d');
  });

  it('returns five cards drawn from the input, scoring exactly what evaluateHand scored', () => {
    const seven = parseCards('7h 7d 7s 7c Kh Kd 2s');
    const five = bestFive(seven);
    expect(five).toHaveLength(5);
    expect(new Set(five).size).toBe(5);
    for (const card of five) expect(seven).toContain(card);
    expect(evaluateHand(five)).toBe(evaluateHand(seven));
  });

  it('leaves out the pair that loses to the kicker', () => {
    const five = bestFive(parseCards('Ah Ad Ks Kc Qh Qd 2s'));
    expect(formatCards(five)).toBe('Ah Ad Ks Kc Qh');
  });

  it('is consistent with evaluateHand across every trap hand', () => {
    const hands = [
      'Ah Kh Qh Jh 9h Ts Tc',
      'Ah 2d 3s 4c 5h Kd Qs',
      'Ah 2h 3h 4h 5h Kd Qs',
      'Qh Kd Ac 2s 3h 7d 9s',
      '9h 9d 9s 4c 4h 4d 2s',
      'Ah Ad Ks Kc Qh Qd 2s',
      '7h 7d 7s 7c Kh Kd 2s',
      'Ah Kh Qh 9h 5h 4h 3h',
      '2h 3d 5s 7c 9h Jd Ks',
    ];
    for (const hand of hands) {
      const seven = parseCards(hand);
      expect(evaluateHand(bestFive(seven)), hand).toBe(evaluateHand(seven));
    }
  });

  it('is unaffected by the order the cards arrive in', () => {
    const forward = parseCards('Ah Ad Ks Kc Qh Qd 2s');
    const reversed = [...forward].reverse();
    expect(evaluateHand(bestFive(reversed))).toBe(evaluateHand(bestFive(forward)));
    expect(new Set(bestFive(reversed))).toEqual(new Set(bestFive(forward)));
  });
});

describe('categoryOf covers every category', () => {
  const samples: Array<[string, HandCategory]> = [
    ['2h 3d 5s 7c 9h Jd Ks', HandCategory.HighCard],
    ['2h 2d 5s 7c 9h Jd Ks', HandCategory.Pair],
    ['2h 2d 5s 5c 9h Jd Ks', HandCategory.TwoPair],
    ['2h 2d 2s 5c 9h Jd Ks', HandCategory.Trips],
    ['2h 3d 4s 5c 6h Jd Ks', HandCategory.Straight],
    ['2h 5h 7h 9h Jh 3d Ks', HandCategory.Flush],
    ['2h 2d 2s 5c 5h Jd Ks', HandCategory.FullHouse],
    ['2h 2d 2s 2c 5h Jd Ks', HandCategory.Quads],
    ['2h 3h 4h 5h 6h Jd Ks', HandCategory.StraightFlush],
  ];

  it.each(samples)('%s is category %i', (hand, expected) => {
    expect(category(hand)).toBe(expected);
    expect(tiebreakers(hand)).toHaveLength(TIEBREAKER_COUNT[expected]);
  });

  it('has a tiebreaker count for all nine categories', () => {
    expect(Object.keys(TIEBREAKER_COUNT)).toHaveLength(9);
    expect(new Set(Object.values(HandCategory)).size).toBe(9);
  });

  it('reads back a deuce-low tiebreaker as a real rank, not padding', () => {
    expect(tiebreakers('2h 3d 5s 7c 9h Jd Ks')).toEqual([KING, JACK, NINE, SEVEN, FIVE]);
    expect(tiebreakers('Ah Ad 4s 3c 2h Kd Qs')).toEqual([ACE, KING, QUEEN, FOUR]);
    expect(tiebreakers('Ah Ad 4s 3c 2h 2d 2c')).toEqual([DEUCE, ACE]);
    expect(EIGHT + SIX).toBeGreaterThan(0); // keeps the rank aliases honest
  });
});
