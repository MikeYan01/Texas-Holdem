import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.mjs'],
          exclude: ['**/*.slow.test.ts'],
          // Vitest defaults to 5s, and several of these legitimately take one to
          // two seconds on a fast laptop — the differential run against `phe`,
          // the `bestFive` property sweep, the Bot decision suite. A shared CI
          // runner is a few times slower than that, which puts them close enough
          // to the default to fail on load rather than on merit. Nothing here can
          // hang: every loop is bounded by an explicit step cap, so a generous
          // ceiling costs nothing and only removes false reds.
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
      {
        test: {
          name: 'slow',
          environment: 'node',
          include: ['src/**/*.slow.test.ts'],
          testTimeout: 900_000,
          hookTimeout: 900_000,
        },
      },
    ],
  },
});
