// The current language, for the parts of the render layer that are React.
//
// The split is deliberate (ADR-0008): modules that turn engine values into words
// — `events.ts`, `hand-description.ts`, `labels.ts` — take a `Locale` argument
// and know nothing about React, so a Node test can assert every line in every
// language. Components, which no test renders, read it from here instead of
// threading a prop through eight levels of markup.
//
// This is also the only place in the project that touches `localStorage`. That
// is fine here and nowhere below it: ADR-0001 puts the ban on IO inside the
// engine, and choosing a language is exactly the kind of thing the render layer
// is for.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_LOCALE, LOCALE_TAGS, isLocale, type Locale } from './text/locale.ts';
import { uiStrings, type UiStrings } from './text/ui-strings.ts';

const STORAGE_KEY = 'texas.locale';

export type LocaleContextValue = {
  readonly locale: Locale;
  readonly setLocale: (locale: Locale) => void;
  /** Interface chrome for the current locale. Named `t` because it is read constantly. */
  readonly t: UiStrings;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * A stored choice wins; otherwise a Chinese-reading browser gets Chinese and
 * everyone else gets the default.
 *
 * Everything is wrapped because `localStorage` throws rather than returning null
 * when a browser has storage disabled, and a language preference is not worth
 * taking the page down for.
 */
function initialLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Storage unavailable; fall through to the browser's preference.
  }
  try {
    if (window.navigator.language.toLowerCase().startsWith('zh')) return 'zh';
  } catch {
    // No navigator; fall through to the default.
  }
  return DEFAULT_LOCALE;
}

export function LocaleProvider({
  children,
  initial,
}: {
  children: ReactNode;
  /** Forces the starting language, for tests and for anything that already knows. */
  initial?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => initial ?? initialLocale());

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies for this visit; it just will not be remembered.
    }
  }, []);

  const t = uiStrings(locale);

  // Keep the document in step: `lang` drives font selection and screen readers,
  // and the tab title is the one piece of interface outside the React tree.
  useEffect(() => {
    document.documentElement.lang = LOCALE_TAGS[locale];
    document.title = t.appTitle;
  }, [locale, t.appTitle]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used inside a LocaleProvider');
  return value;
}
