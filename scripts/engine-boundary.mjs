// Engine-boundary checker.
//
// The engine side of this codebase (see ADR-0001) must be a zero-dependency pure
// module: no UI framework, no DOM, no network, no timers, no ambient randomness or
// clock. This script is the automated guard for that rule. It is deliberately
// dependency-free and text-based so it can run anywhere, including in CI before
// anything is built.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/** Directories that make up the engine side. Paths are repo-relative. */
export const ENGINE_ROOTS = ['src/poker-math', 'src/engine', 'src/bots'];

const FORBIDDEN_GLOBALS = [
  // UI framework / DOM
  { pattern: /\bwindow\b/, reason: 'accesses `window`' },
  { pattern: /\bdocument\b/, reason: 'accesses `document`' },
  { pattern: /\bnavigator\b/, reason: 'accesses `navigator`' },
  { pattern: /\blocalStorage\b/, reason: 'accesses `localStorage`' },
  { pattern: /\bsessionStorage\b/, reason: 'accesses `sessionStorage`' },
  { pattern: /\bHTMLElement\b/, reason: 'accesses a DOM type' },
  // Network
  { pattern: /\bfetch\s*\(/, reason: 'calls `fetch`' },
  { pattern: /\bXMLHttpRequest\b/, reason: 'uses `XMLHttpRequest`' },
  { pattern: /\bWebSocket\b/, reason: 'uses `WebSocket`' },
  // Timers / scheduling: the engine never sleeps, it is driven by delivered actions
  { pattern: /\bsetTimeout\b/, reason: 'uses `setTimeout`' },
  { pattern: /\bsetInterval\b/, reason: 'uses `setInterval`' },
  { pattern: /\bsetImmediate\b/, reason: 'uses `setImmediate`' },
  { pattern: /\brequestAnimationFrame\b/, reason: 'uses `requestAnimationFrame`' },
  { pattern: /\bqueueMicrotask\b/, reason: 'uses `queueMicrotask`' },
  // Ambient randomness and clock: both must be injected so runs are reproducible
  { pattern: /\bMath\s*\.\s*random\b/, reason: 'uses `Math.random` (RNG must be injected)' },
  { pattern: /\bDate\s*\.\s*now\b/, reason: 'reads the wall clock via `Date.now`' },
  { pattern: /\bnew\s+Date\b/, reason: 'reads the wall clock via `new Date`' },
  { pattern: /\bperformance\s*\.\s*now\b/, reason: 'reads the wall clock via `performance.now`' },
  { pattern: /\bprocess\s*\./, reason: 'touches `process`' },
];

const IMPORT_RE =
  /(?:^|[\s;}])(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * Blank out comments, and optionally string/template literal bodies, preserving
 * offsets and newlines so reported line numbers stay true to the original.
 *
 * The forbidden-globals scan runs with `blankStrings` on, so it cannot fire on
 * prose or data. The import scan runs with it off, because it has to read the
 * module specifier out of the string it lives in.
 */
function blankNonCode(source, { blankStrings }) {
  const out = source.split('');
  let i = 0;
  const n = source.length;
  const blank = (from, to) => {
    for (let k = from; k < to && k < n; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      let j = i + 2;
      while (j < n && source[j] !== '\n') j++;
      blank(i, j);
      i = j;
    } else if (ch === '/' && next === '*') {
      let j = i + 2;
      while (j < n && !(source[j] === '*' && source[j + 1] === '/')) j++;
      blank(i, Math.min(j + 2, n));
      i = j + 2;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < n) {
        if (source[j] === '\\') {
          j += 2;
          continue;
        }
        if (source[j] === ch) break;
        j++;
      }
      if (blankStrings) blank(i + 1, j);
      i = j + 1;
    } else {
      i++;
    }
  }
  return out.join('');
}

function lineOf(source, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (source[i] === '\n') line++;
  return line;
}

function listSourceFiles(dir) {
  const found = [];
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) found.push(full);
    }
  };
  walk(dir);
  return found;
}

const isTestFile = (path) => /\.test\.[a-z]+$/.test(path);

/**
 * Scan the engine side for boundary violations.
 *
 * @param {object} [options]
 * @param {string} [options.cwd] Repository root to resolve roots against.
 * @param {string[]} [options.roots] Engine-side directories, relative to cwd.
 * @param {boolean} [options.includeTests] Also check `*.test.*` files. Tests are
 *   skipped by default: they legitimately import the test runner, and it is the
 *   shipped engine code that has to stay pure.
 * @returns {{file: string, line: number, reason: string}[]} Violations found.
 */
export function checkEngineBoundary(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const roots = options.roots ?? ENGINE_ROOTS;
  const includeTests = options.includeTests ?? false;
  const violations = [];

  for (const root of roots) {
    const absoluteRoot = resolve(cwd, root);
    let files;
    try {
      files = listSourceFiles(absoluteRoot);
    } catch {
      continue; // A root that does not exist yet is not a violation.
    }
    for (const file of files) {
      if (!includeTests && isTestFile(file)) continue;
      const relativePath = relative(cwd, file).split(sep).join('/');
      const source = readFileSync(file, 'utf8');
      const codeOnly = blankNonCode(source, { blankStrings: true });
      const withStrings = blankNonCode(source, { blankStrings: false });

      for (const { pattern, reason } of FORBIDDEN_GLOBALS) {
        const scan = new RegExp(pattern.source, 'g');
        let hit;
        while ((hit = scan.exec(codeOnly)) !== null) {
          violations.push({ file: relativePath, line: lineOf(source, hit.index), reason });
        }
      }

      IMPORT_RE.lastIndex = 0;
      let match;
      while ((match = IMPORT_RE.exec(withStrings)) !== null) {
        const specifier = match[1] ?? match[2] ?? match[3];
        if (specifier === undefined) continue;
        const line = lineOf(source, match.index);
        if (!specifier.startsWith('.')) {
          violations.push({
            file: relativePath,
            line,
            reason: `imports the non-relative module '${specifier}' (the engine must have zero dependencies)`,
          });
          continue;
        }
        const target = resolve(file, '..', specifier);
        const insideEngine = roots.some((r) => {
          const engineRoot = resolve(cwd, r);
          return target === engineRoot || target.startsWith(engineRoot + sep);
        });
        if (!insideEngine) {
          violations.push({
            file: relativePath,
            line,
            reason: `imports '${specifier}', which reaches outside the engine side`,
          });
        }
      }
    }
  }

  violations.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  return violations;
}
