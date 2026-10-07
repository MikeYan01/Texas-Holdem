import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { checkEngineBoundary, ENGINE_ROOTS } from './engine-boundary.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const fixtureRoot = fileURLToPath(new URL('fixtures/engine-boundary-violation', import.meta.url));

const scanFixture = () => checkEngineBoundary({ cwd: fixtureRoot, roots: ['engine'] });
const reasonsFor = (file) =>
  scanFixture()
    .filter((v) => v.file === file)
    .map((v) => v.reason);

describe('engine boundary checker', () => {
  it('reports nothing for the real engine side', () => {
    expect(checkEngineBoundary({ cwd: repoRoot, roots: ENGINE_ROOTS })).toEqual([]);
  });

  it('leaves a clean engine-side file alone', () => {
    expect(reasonsFor('engine/clean.ts')).toEqual([]);
  });

  it('catches a UI framework import', () => {
    expect(reasonsFor('engine/uses-react.ts')).toContainEqual(expect.stringContaining("'react'"));
  });

  it('catches DOM access', () => {
    const reasons = reasonsFor('engine/uses-dom.ts');
    expect(reasons).toContainEqual(expect.stringContaining('window'));
    expect(reasons).toContainEqual(expect.stringContaining('document'));
  });

  it('catches timers', () => {
    expect(reasonsFor('engine/uses-timer.ts')).toContainEqual(expect.stringContaining('setTimeout'));
  });

  it('catches ambient randomness', () => {
    expect(reasonsFor('engine/uses-ambient-randomness.ts')).toContainEqual(
      expect.stringContaining('Math.random'),
    );
  });

  it('catches a relative import that escapes the engine side', () => {
    expect(reasonsFor('engine/reaches-into-ui.ts')).toContainEqual(
      expect.stringContaining('outside the engine side'),
    );
  });

  it('reports a line number for every violation', () => {
    for (const violation of scanFixture()) expect(violation.line).toBeGreaterThan(0);
  });
});
