import { describe, expect, it } from 'vitest';
import { DECK_SIZE } from './cards.ts';
import { evaluate7 } from './evaluate-hand.ts';
import { seededRng } from './rng.ts';

// An order-of-magnitude guard, not a benchmark. The reference implementation
// measured ~4.1M evaluations/second on an M3 Pro; the floor here is set an order
// of magnitude below that so it survives a slow CI box but still fires if
// someone reintroduces per-call allocation or an accidental sort.
const FLOOR_EVALS_PER_SECOND = 300_000;

describe('evaluator performance baseline', () => {
  it('evaluates far more than the floor rate', () => {
    const rng = seededRng(4242);
    const deck = Int32Array.from({ length: DECK_SIZE }, (_, i) => i);
    const hand = new Int32Array(7);
    const iterations = 200_000;

    // Warm up so the measurement is not dominated by the first-tier compile.
    for (let i = 0; i < 20_000; i++) {
      for (let k = 0; k < 7; k++) hand[k] = (rng() * DECK_SIZE) | 0;
      evaluate7(hand);
    }

    const started = globalThis.performance.now();
    let checksum = 0;
    for (let i = 0; i < iterations; i++) {
      for (let k = 0; k < 7; k++) {
        const j = k + ((rng() * (DECK_SIZE - k)) | 0);
        const swap = deck[k]!;
        deck[k] = deck[j]!;
        deck[j] = swap;
        hand[k] = deck[k]!;
      }
      checksum ^= evaluate7(hand);
    }
    const elapsedSeconds = (globalThis.performance.now() - started) / 1000;
    const rate = iterations / elapsedSeconds;

    expect(checksum).not.toBe(0); // keeps the loop from being optimised away
    expect(rate).toBeGreaterThan(FLOOR_EVALS_PER_SECOND);
  });
});
