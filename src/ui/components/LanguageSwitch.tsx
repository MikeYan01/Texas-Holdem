import { LOCALES, LOCALE_NAMES, LOCALE_TAGS } from '../text/locale.ts';
import { useLocale } from '../locale-context.tsx';

/**
 * The language switch, parked in the corner of every screen.
 *
 * Each option is written in its own language: "Chinese" is no help to somebody
 * who cannot read English, and 「英语」is no help the other way round. Two
 * buttons rather than a select, because with two options a dropdown costs a
 * click to show you what you already knew.
 */
export function LanguageSwitch() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className="langswitch" role="group" aria-label={t.language.label}>
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          className={`langswitch__option ${option === locale ? 'is-active' : ''}`}
          lang={LOCALE_TAGS[option]}
          aria-pressed={option === locale}
          onClick={() => setLocale(option)}
        >
          {LOCALE_NAMES[option]}
        </button>
      ))}
    </div>
  );
}
