import { DEFAULT_CONFIG } from '../../engine/types.ts';
import { parseCards } from '../../poker-math/cards.ts';
import { PlayingCard } from '../components/PlayingCard.tsx';
import { useLocale } from '../locale-context.tsx';

const HERO_HAND = parseCards('Ah As');

/**
 * One button, no configuration.
 *
 * No difficulty setting on purpose (issue 13): a knob sounds cheap but means tuning and validating every notch against real play.
 * One of each personality is itself the design — it guarantees a tight player, a loose one, a station and a bluffer at every table, which tells you far more than a slider would.
 *
 * The line-up is deliberately not listed here either.
 * Naming each Bot's style up front hands you the read for free, and working out who is tight and who is bluffing is most of what there is to learn at this table.
 */
export function StartScreen({ onStart }: { onStart: () => void }) {
  const { t } = useLocale();
  const { seatCount, handsPerSession, smallBlind, bigBlind } = DEFAULT_CONFIG;

  return (
    <main className="screen screen--start">
      <div className="start__layout">
        <div className="start__copy">
          <h1 className="screen__title">{t.appTitle}</h1>
          <dl className="start__facts">
            <div><dt>{t.start.seats}</dt><dd>{seatCount}</dd></div>
            <div><dt>{t.start.hands}</dt><dd>{handsPerSession}</dd></div>
            <div><dt>{t.start.blinds}</dt><dd>{smallBlind} / {bigBlind}</dd></div>
          </dl>
          <button type="button" className="btn btn--primary btn--large" onClick={onStart}>
            {t.start.begin}
            <span className="button-arrow" aria-hidden="true">↗</span>
          </button>
        </div>

        <div className="start__art" aria-hidden="true">
          <div className="start__orbit" />
          <div className="start__fan">
            <span className="start__fan-glow" />
            {HERO_HAND.map((card, index) => (
              <span key={card} className="start__fan-slot">
                <PlayingCard card={card} size="board" dealIndex={index} />
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
