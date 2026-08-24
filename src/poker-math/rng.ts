// The single source of randomness for the engine side.
//
// Nothing in `src/poker-math`, `src/engine` or `src/bots` may call `Math.random`
// — the boundary checker fails the build if it does. Randomness is injected as a
// plain `() => number` in `[0, 1)` so that every shuffle, every Monte Carlo run
// and every bot decision can be replayed exactly from a seed. A test that fails
// once has to be able to fail again.

/** Returns a number in `[0, 1)`. */
export type Rng = () => number;

/**
 * The internal state of the generator, as a plain value. The engine stores this
 * on its state so `reduce` stays a pure function: same state plus same action
 * gives the same next state, shuffle included.
 */
export type RngState = number;

const STEP = 0x6d2b79f5;

const scramble = (state: number): number => {
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * mulberry32. Chosen over a plain LCG because the Monte Carlo equity loop leans
 * on the low bits (`(rng() * n) | 0` over small ranges) and an LCG's low bits are
 * notoriously non-random.
 *
 * The body is written out rather than delegating to `rngStep` so the hot equity
 * loop stays free of the tuple allocation that a value-plus-state return needs.
 */
export function seededRng(seed: number): Rng {
  let state = seed | 0;
  return () => {
    state = (state + STEP) | 0;
    return scramble(state);
  };
}

/** One draw, as a value: the number in `[0, 1)` and the state that follows it. */
export function rngStep(state: RngState): { readonly value: number; readonly next: RngState } {
  const next = (state + STEP) | 0;
  return { value: scramble(next), next };
}

/**
 * A short-lived stateful view over an `RngState`, for code that wants to draw a
 * handful of numbers and then store where it got to. Used by the reducer, which
 * needs both a convenient `Rng` and a value it can put back on the state.
 */
export function rngCursor(initial: RngState): { readonly rng: Rng; state: () => RngState } {
  let state = initial;
  return {
    rng: () => {
      const step = rngStep(state);
      state = step.next;
      return step.value;
    },
    state: () => state,
  };
}

/** Uniform integer in `[0, bound)`. */
export const randomInt = (rng: Rng, bound: number): number => (rng() * bound) | 0;

/** Fisher-Yates, in place. */
export function shuffleInPlace<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    const swap = items[i]!;
    items[i] = items[j]!;
    items[j] = swap;
  }
  return items;
}
