import { describe, expect, it } from 'vitest';

// `phe` exists purely so the tests can differentially check our own evaluator
// (ADR-0004). It is a dev dependency and must never appear in the runtime bundle;
// the engine-boundary checker enforces the second half of that.
describe('phe, the differential-testing reference', () => {
  it('is importable from tests', async () => {
    const phe = await import('phe');
    expect(typeof phe.evaluateCardCodes).toBe('function');
  });

  it('scores a royal flush better than a pair', async () => {
    const { evaluateCardCodes } = await import('phe');
    // Card code = rank * 4 + suit, rank 0..12 for 2..A, suit 0..3.
    const royal = [12 * 4, 11 * 4, 10 * 4, 9 * 4, 8 * 4, 0 * 4 + 1, 1 * 4 + 1];
    const pair = [12 * 4, 12 * 4 + 1, 0 * 4, 1 * 4 + 1, 2 * 4 + 2, 3 * 4 + 3, 5 * 4 + 1];
    // phe ranks are inverted: lower is stronger.
    expect(evaluateCardCodes(royal)).toBeLessThan(evaluateCardCodes(pair));
  });
});
