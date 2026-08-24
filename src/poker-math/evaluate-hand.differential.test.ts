import { describe, expect, it } from 'vitest';
import { evaluateCardCodes } from 'phe';
import { DECK_SIZE } from './cards.ts';
import { evaluate7 } from './evaluate-hand.ts';
import { seededRng } from './rng.ts';

// Differential test against `phe` (a dev dependency only — ADR-0004). `phe`
// inverts the direction: lower is stronger there, higher is stronger here. What
// this pins down is that the two agree on ORDER and, just as importantly, on
// EQUALITY: a disagreement about ties is a disagreement about who splits a pot.

const COMPARISONS = 300_000;

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

function dealTwoHands(rng: () => number, deck: Int32Array, left: Int32Array, right: Int32Array) {
  for (let i = 0; i < 14; i++) {
    const j = i + ((rng() * (DECK_SIZE - i)) | 0);
    const swap = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = swap;
  }
  for (let i = 0; i < 7; i++) {
    left[i] = deck[i]!;
    right[i] = deck[7 + i]!;
  }
}

describe('differential test against phe', () => {
  it('never disagrees about which of two random seven-card hands is stronger', () => {
    const rng = seededRng(20_260_824);
    const deck = Int32Array.from({ length: DECK_SIZE }, (_, i) => i);
    const left = new Int32Array(7);
    const right = new Int32Array(7);
    let disagreements = 0;
    let ties = 0;

    for (let i = 0; i < COMPARISONS; i++) {
      dealTwoHands(rng, deck, left, right);
      const ours = sign(evaluate7(left) - evaluate7(right));
      // Negated: phe scores lower as stronger.
      const theirs = sign(evaluateCardCodes(right) - evaluateCardCodes(left));
      if (ours !== theirs) disagreements++;
      if (ours === 0) ties++;
    }

    expect(disagreements).toBe(0);
    // A sanity floor: if ties never happened, the equality half of the contract
    // would be silently untested. Ties between two independent seven-card hands
    // are rare — a few dozen per 300k — so this only asserts that they occur.
    expect(ties).toBeGreaterThan(25);
  });

  it('never disagrees about whether a shared-board showdown is a tie', () => {
    const rng = seededRng(99_999);
    const deck = Int32Array.from({ length: DECK_SIZE }, (_, i) => i);
    const left = new Int32Array(7);
    const right = new Int32Array(7);
    let disagreements = 0;
    let ties = 0;

    for (let i = 0; i < COMPARISONS; i++) {
      // Nine cards: two hole cards each plus a five-card shared board. This is
      // the shape a real showdown has, and ties are far more common here.
      for (let k = 0; k < 9; k++) {
        const j = k + ((rng() * (DECK_SIZE - k)) | 0);
        const swap = deck[k]!;
        deck[k] = deck[j]!;
        deck[j] = swap;
      }
      left[0] = deck[0]!;
      left[1] = deck[1]!;
      right[0] = deck[2]!;
      right[1] = deck[3]!;
      for (let k = 0; k < 5; k++) {
        left[2 + k] = deck[4 + k]!;
        right[2 + k] = deck[4 + k]!;
      }
      const ourTie = evaluate7(left) === evaluate7(right);
      const theirTie = evaluateCardCodes(left) === evaluateCardCodes(right);
      if (ourTie !== theirTie) disagreements++;
      if (ourTie) ties++;
    }

    expect(disagreements).toBe(0);
    expect(ties).toBeGreaterThan(1000);
  });
});
