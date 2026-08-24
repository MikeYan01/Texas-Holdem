import { useEffect, useLayoutEffect, useRef } from 'react';
import type { LogLine } from '../text/events.ts';

export type ActionLogProps = {
  readonly lines: readonly LogLine[];
  readonly collapsed: boolean;
  readonly onToggle: () => void;
};

/**
 * The running commentary. Almost everything you can learn about an opponent is in
 * the order and size of what they did, so it earns a permanent column rather than
 * a toast that fades.
 *
 * It scrolls inside its own box and pins itself to the bottom, so the newest
 * lines are the ones on screen. That is not cosmetic: thirty Hands of commentary
 * is unbounded, and anything that let it size the page would drag the felt taller
 * with it until the table no longer fitted on screen.
 */
export function ActionLog({ lines, collapsed, onToggle }: ActionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  // Follow along only while the reader is already at the bottom. If they have
  // scrolled up to re-read a Hand, leave them where they are.
  useLayoutEffect(() => {
    const box = scrollRef.current;
    if (!box || collapsed || !pinnedRef.current) return;
    // scrollTop rather than scrollIntoView: the latter walks up the ancestors and
    // can scroll the page itself.
    box.scrollTop = box.scrollHeight;
  }, [lines, collapsed]);

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
        <button type="button" className="log__reopen" onClick={onToggle} title="展开行动记录">
          行动记录 ›
        </button>
      </aside>
    );
  }

  return (
    <aside className="log">
      <h2 className="log__title">
        行动记录
        <button type="button" className="log__toggle" onClick={onToggle} title="收起行动记录">
          收起 ‹
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
