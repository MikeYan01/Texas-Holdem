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
