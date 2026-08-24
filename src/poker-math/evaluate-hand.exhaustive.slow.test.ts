import { describe, expect, it } from 'vitest';
import { DECK_SIZE } from './cards.ts';
import { HandCategory, evaluate7 } from './evaluate-hand.ts';

// The whole case for hand-writing an evaluator (ADR-0004) rests on this file: if
// all 133,784,560 seven-card hands land in the right category, "we wrote it
// ourselves" stops being a risk. It has to stay in CI for that reason. Takes
// roughly 30-60 seconds.

// Published seven-card frequencies. Independent of any implementation here.
const PUBLISHED: Record<HandCategory, number> = {
  [HandCategory.HighCard]: 23_294_460,
  [HandCategory.Pair]: 58_627_800,
  [HandCategory.TwoPair]: 31_433_400,
  [HandCategory.Trips]: 6_461_620,
  [HandCategory.Straight]: 6_180_020,
  [HandCategory.Flush]: 4_047_644,
  [HandCategory.FullHouse]: 3_473_184,
  [HandCategory.Quads]: 224_848,
  [HandCategory.StraightFlush]: 41_584,
};

const TOTAL_SEVEN_CARD_HANDS = 133_784_560;

describe('exhaustive verification over every seven-card hand', () => {
  it('produces exactly the published category frequencies', () => {
    const frequency = new Float64Array(9);
    const hand = new Int32Array(7);
    let dealt = 0;

    for (let a = 0; a < DECK_SIZE; a++) {
      hand[0] = a;
      for (let b = a + 1; b < DECK_SIZE; b++) {
        hand[1] = b;
        for (let c = b + 1; c < DECK_SIZE; c++) {
          hand[2] = c;
          for (let d = c + 1; d < DECK_SIZE; d++) {
            hand[3] = d;
            for (let e = d + 1; e < DECK_SIZE; e++) {
              hand[4] = e;
              for (let f = e + 1; f < DECK_SIZE; f++) {
                hand[5] = f;
                for (let g = f + 1; g < DECK_SIZE; g++) {
                  hand[6] = g;
                  frequency[evaluate7(hand) >>> 20]!++;
                  dealt++;
                }
              }
            }
          }
        }
      }
    }

    expect(dealt).toBe(TOTAL_SEVEN_CARD_HANDS);

    const observed = Object.fromEntries(
      Object.entries(PUBLISHED).map(([category]) => [category, frequency[Number(category)]!]),
    );
    expect(observed).toEqual(
      Object.fromEntries(Object.entries(PUBLISHED).map(([k, v]) => [k, v])),
    );

    const summed = Array.from(frequency).reduce((total, count) => total + count, 0);
    expect(summed).toBe(TOTAL_SEVEN_CARD_HANDS);
  });
});
