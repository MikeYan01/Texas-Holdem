// The two languages the interface speaks, and nothing else.
//
// This module is deliberately free of React and of the DOM. The pure text
// modules beside it take a `Locale` as an explicit argument rather than reading
// it from a context, which is what keeps `describeEvent` and `describeHand`
// testable under bare Node — the same reason the engine takes its RNG as a
// number on the state (ADR-0001).
//
// The engine is unaffected by any of this. It emits structured events and error
// codes; every word a human reads is chosen here or in the modules beside this
// one (AGENTS.md, ADR-0008).

/** Listed in the order the switch offers them, default first. */
export const LOCALES = ['en', 'zh'] as const;

export type Locale = (typeof LOCALES)[number];

/** English, as the wider of the two audiences. Chinese is one click away. */
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Each language named in itself. A switcher that says "Chinese" to somebody who
 * cannot read English is no use to them.
 */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
};

/** BCP 47 tags, for `<html lang>` and for `Intl` number grouping. */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: 'en-US',
  zh: 'zh-CN',
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
