import { describe, expect, it } from 'vitest';
import { randomInt, rngCursor, rngStep, seededRng, shuffleInPlace } from './rng.ts';

describe('seededRng', () => {
  it('stays inside [0, 1)', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 10_000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('replays exactly from the same seed, which is what makes failures reproducible', () => {
    const a = seededRng(1234);
    const b = seededRng(1234);
    for (let i = 0; i < 1000; i++) expect(a()).toBe(b());
  });

  it('gives different streams for different seeds', () => {
    const a = seededRng(1);
    const b = seededRng(2);
    const differences: number[] = Array.from({ length: 100 }, () => (a() === b() ? 0 : 1));
    expect(differences.reduce((x, y) => x + y, 0)).toBeGreaterThan(90);
  });

  it('spreads roughly evenly across buckets', () => {
    const rng = seededRng(42);
    const buckets = new Array(10).fill(0);
    const draws = 100_000;
    for (let i = 0; i < draws; i++) buckets[randomInt(rng, 10)]++;
    for (const count of buckets) expect(Math.abs(count - draws / 10)).toBeLessThan(draws / 50);
  });

  it('spreads evenly over a small range, where a weak generator would band', () => {
    const rng = seededRng(9);
    const buckets = new Array(52).fill(0);
    const draws = 520_000;
    for (let i = 0; i < draws; i++) buckets[randomInt(rng, 52)]++;
    for (const count of buckets) expect(Math.abs(count - draws / 52)).toBeLessThan(draws / 520);
  });
});

describe('shuffleInPlace', () => {
  it('keeps every element, changing only the order', () => {
    const deck = Array.from({ length: 52 }, (_, i) => i);
    shuffleInPlace(deck, seededRng(5));
    expect([...deck].sort((a, b) => a - b)).toEqual(Array.from({ length: 52 }, (_, i) => i));
  });

  it('produces the same permutation from the same seed', () => {
    const one = shuffleInPlace(
      Array.from({ length: 52 }, (_, i) => i),
      seededRng(2026),
    );
    const two = shuffleInPlace(
      Array.from({ length: 52 }, (_, i) => i),
      seededRng(2026),
    );
    expect(one).toEqual(two);
  });

  it('actually moves things around', () => {
    const original = Array.from({ length: 52 }, (_, i) => i);
    const shuffled = shuffleInPlace([...original], seededRng(11));
    const fixedPoints = shuffled.filter((card, index) => card === original[index]).length;
    expect(fixedPoints).toBeLessThan(10);
  });

  it('reaches every permutation of a three-element array', () => {
    const rng = seededRng(3);
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) seen.add(shuffleInPlace(['a', 'b', 'c'], rng).join(''));
    expect(seen.size).toBe(6);
  });
});

describe('the value-shaped rng, which is what keeps reduce pure', () => {
  it('produces the same stream as the closure form', () => {
    const closure = seededRng(777);
    let state = 777;
    for (let i = 0; i < 500; i++) {
      const step = rngStep(state);
      state = step.next;
      expect(step.value).toBe(closure());
    }
  });

  it('is a pure function of its state', () => {
    expect(rngStep(12_345)).toEqual(rngStep(12_345));
  });

  it('lets a cursor hand back the state it reached', () => {
    const cursor = rngCursor(2026);
    const drawn = Array.from({ length: 10 }, () => cursor.rng());
    const resumed = rngCursor(cursor.state());
    const continued = Array.from({ length: 10 }, () => resumed.rng());

    const straightThrough = seededRng(2026);
    const expected = Array.from({ length: 20 }, () => straightThrough());
    expect([...drawn, ...continued]).toEqual(expected);
  });
});
