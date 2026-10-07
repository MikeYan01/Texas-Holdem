import { useLocale } from '../locale-context.tsx';

/** A reliable web fallback for browsers that do not expose orientation locking. */
export function RotateDeviceNotice() {
  const { t } = useLocale();

  return (
    <aside className="rotate-notice" role="status">
      <span className="rotate-notice__phone" aria-hidden="true" />
      <strong className="rotate-notice__title">{t.orientation.title}</strong>
      <span className="rotate-notice__body">{t.orientation.body}</span>
    </aside>
  );
}
