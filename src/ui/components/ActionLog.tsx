import { useEffect, useLayoutEffect, useRef } from 'react';
import { describeEvent, type SeatNamer } from '../text/events.ts';
import { useLocale } from '../locale-context.tsx';
import type { LoggedEvent } from '../useGameSession.ts';

export type ActionLogProps = {
  /** The events themselves, turned into words here so a language switch reaches
      back over everything already played. */
  readonly entries: readonly LoggedEvent[];
  readonly nameOf: SeatNamer;
  /** Which Seat the commentary addresses in the second person. */
  readonly playerSeat: number;
  readonly collapsed: boolean;
  readonly onToggle: () => void;
};

/**
 * The running commentary. Almost everything you can learn about an opponent is in
 * the order and size of what they did, so it earns a permanent column rather than
 * a toast that fades.
 *
 * It scrolls inside its own box and pins itself to the bottom, so the newest
 * lines are the ones on screen. That is not cosmetic: a whole Session of
 * commentary is unbounded, and anything that let it size the page would drag the
 * felt taller with it until the table no longer fitted on screen.
 */
export function ActionLog({ entries, nameOf, playerSeat, collapsed, onToggle }: ActionLogProps) {
  const { locale, t } = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  const lines = entries.flatMap((entry) => {
    const described = describeEvent(entry.event, nameOf, locale, playerSeat);
    return described ? [{ id: entry.id, ...described }] : [];
  });

  // Follow along only while the reader is already at the bottom. If they have
  // scrolled up to re-read a Hand, leave them where they are.
  //
  // The dependency is `entries`, not `lines`: the lines are rebuilt on every
  // render, so depending on them would re-pin the scroll constantly. `locale` is
  // in there because switching language rewrites every line, and the reader
  // should still be looking at the newest one afterwards.
  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!box || collapsed || !pinnedRef.current) return;
    // scrollTop rather than scrollIntoView: the latter walks up the ancestors and
    // can scroll the page itself.
    box.scrollTop = box.scrollHeight;
  }, [entries, collapsed, locale]);

  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const onScroll = () => {
      pinnedRef.current = box.scrollHeight - box.scrollTop - box.clientHeight < 24;
    };
    box.addEventListener('scroll', onScroll, { passive: true });
    return () => box.removeEventListener('scroll', onScroll);
  }, [collapsed]);

  if (collapsed) {
    return (
      <aside className="log log--collapsed">
        <button type="button" className="log__reopen" onClick={onToggle} title={t.log.reopenNote}>
          {t.log.reopen}
        </button>
      </aside>
    );
  }

  return (
    <aside className="log">
      <h2 className="log__title">
        {t.log.title}
        <button type="button" className="log__toggle" onClick={onToggle} title={t.log.collapseNote}>
          {t.log.collapse}
        </button>
      </h2>
      <div className="log__scroll" ref={scrollRef}>
        {lines.map((line) => (
          <div key={line.id} className={`log__line log__line--${line.tone}`}>
            {line.text}
          </div>
        ))}
      </div>
    </aside>
  );
}
