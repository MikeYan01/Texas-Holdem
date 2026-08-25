import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_NAMES,
  LOCALE_TAGS,
  isLocale,
  type Locale,
} from './locale.ts';
import { UI_STRINGS, uiStrings } from './ui-strings.ts';

/**
 * These are the tests that make adding a third language safe.
 *
 * TypeScript already refuses a bundle with a missing key, because `UI_STRINGS`
 * is a `Record<Locale, UiStrings>`. What it cannot see is a key present but
 * empty, a function that forgets to interpolate one of its arguments, or a
 * bundle that quietly copies the other language's words. Those are the ways a
 * half-translated interface actually ships.
 */

type Leaf = string | ((...args: never[]) => string);
type Node = Leaf | { readonly [key: string]: Node };

/** Every leaf in a bundle, as `dotted.path` → value. */
function leaves(node: Node, path: string[] = []): Array<[string, Leaf]> {
  if (typeof node === 'string' || typeof node === 'function') return [[path.join('.'), node]];
  return Object.entries(node).flatMap(([key, child]) => leaves(child, [...path, key]));
}

/**
 * Call a string-producing leaf with plausible arguments.
 *
 * The probes are deliberately values that read as wrong if they leak: a stray
 * `undefined` or `NaN` in the output means an argument was dropped.
 */
function render(leaf: Leaf): string {
  if (typeof leaf === 'string') return leaf;
  const probes = Array.from({ length: leaf.length }, (_, i) => (i === 0 ? 7 : 3));
  return (leaf as (...args: unknown[]) => string)(...probes);
}

describe('locale', () => {
  it('offers exactly the languages it has names and tags for', () => {
    for (const locale of LOCALES) {
      expect(LOCALE_NAMES[locale]).toBeTruthy();
      expect(LOCALE_TAGS[locale]).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
    expect(new Set(Object.values(LOCALE_TAGS)).size).toBe(LOCALES.length);
  });

  it('defaults to English, and lists the default first', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    // The switch renders `LOCALES` in order, so the default leads it.
    expect(LOCALES[0]).toBe(DEFAULT_LOCALE);
    expect(LOCALES).toContain('zh');
  });

  it('names each language in itself, so the switch is readable from either side', () => {
    expect(LOCALE_NAMES.zh).toBe('中文');
    expect(LOCALE_NAMES.en).toBe('English');
  });

  it('recognises only the languages it actually has', () => {
    expect(isLocale('zh')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe('UI_STRINGS', () => {
  const [first, ...rest] = LOCALES;
  const reference = leaves(UI_STRINGS[first!] as unknown as Node);

  it('has the same shape in every language', () => {
    const keys = reference.map(([key]) => key);
    for (const locale of rest) {
      const other = leaves(UI_STRINGS[locale] as unknown as Node);
      expect(other.map(([key]) => key), locale).toEqual(keys);
      for (const [key, leaf] of other) {
        const [, mirror] = reference.find(([candidate]) => candidate === key)!;
        expect(typeof leaf, `${locale}.${key}`).toBe(typeof mirror);
        if (typeof leaf === 'function' && typeof mirror === 'function') {
          // A language that takes fewer arguments is a language that is about to
          // drop one of the numbers on screen.
          expect(leaf.length, `${locale}.${key}`).toBe(mirror.length);
        }
      }
    }
  });

  it('renders every entry, in every language, without losing an argument', () => {
    for (const locale of LOCALES) {
      for (const [key, leaf] of leaves(UI_STRINGS[locale] as unknown as Node)) {
        const text = render(leaf);
        expect(typeof text, `${locale}.${key}`).toBe('string');
        expect(text.trim(), `${locale}.${key}`).not.toBe('');
        expect(text, `${locale}.${key}`).not.toContain('undefined');
        expect(text, `${locale}.${key}`).not.toContain('NaN');
        expect(text, `${locale}.${key}`).not.toContain('[object Object]');
      }
    }
  });

  it('is actually translated: no entry is word-for-word the other language', () => {
    // Two exceptions, both deliberate: "all-in" stays in English everywhere
    // (AGENTS.md), and 1/2-pot is a fraction rather than a word.
    const sharedOnPurpose = new Set(['actions.allIn', 'actions.halfPot']);
    const shared: string[] = [];
    for (const [key, leaf] of reference) {
      if (sharedOnPurpose.has(key)) continue;
      const mine = render(leaf);
      for (const locale of rest) {
        const [, theirs] = leaves(UI_STRINGS[locale] as unknown as Node).find(
          ([candidate]) => candidate === key,
        )!;
        if (render(theirs) === mine) shared.push(`${key} (${first} = ${locale})`);
      }
    }
    expect(shared).toEqual([]);
  });

  it('never leaks Chinese into the English bundle', () => {
    for (const [key, leaf] of leaves(UI_STRINGS.en as unknown as Node)) {
      expect(render(leaf), `en.${key}`).not.toMatch(/[\u4e00-\u9fff]/);
    }
  });

  it('hands back the bundle for the locale it was asked for', () => {
    for (const locale of LOCALES) {
      expect(uiStrings(locale)).toBe(UI_STRINGS[locale as Locale]);
    }
  });
});
