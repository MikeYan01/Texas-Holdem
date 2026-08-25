import { DEFAULT_CONFIG } from '../../engine/types.ts';
import { parseCards } from '../../poker-math/cards.ts';
import { PlayingCard } from '../components/PlayingCard.tsx';
import { useLocale } from '../locale-context.tsx';

/**
 * The best hand in the game, fanned out above the title and dealt one card at a
 * time as the screen arrives.
 *
 * Purely decorative — hence `aria-hidden` — but it is drawn with the same
 * `PlayingCard` the felt uses rather than with an illustration, so the start
 * screen is made out of the game it is introducing.
 */
const HERO_HAND = parseCards('Ts Js Qs Ks As');

/**
 * One button, no configuration.
 *
 * No difficulty setting on purpose (issue 13): a knob sounds cheap but means
 * tuning and validating every notch against real play. One of each personality
 * is itself the design — it guarantees a tight player, a loose one, a station and
 * a maniac at every table, which tells you far more than a slider would.
 *
 * The line-up is deliberately not listed here either. Naming each Bot's style up
 * front hands you the read for free, and working out who is tight and who is
 * bluffing is most of what there is to learn at this table.
 */
export function StartScreen({ onStart }: { onStart: () => void }) {
  const { t } = useLocale();
  const { seatCount, handsPerSession } = DEFAULT_CONFIG;

  return (
    <main className="screen screen--start">
      <div className="start__fan" aria-hidden="true">
        <span className="start__fan-glow" />
        {HERO_HAND.map((card, index) => (
          <span key={card} className="start__fan-slot">
            <PlayingCard card={card} size="board" dealIndex={index} />
          </span>
        ))}
      </div>

      <h1 className="screen__title">{t.appTitle}</h1>

      <div className="start__rule" aria-hidden="true">
        <span className="start__rule-line" />
        <span className="start__rule-pip">♠</span>
        <span className="start__rule-line" />
      </div>

      <p className="screen__lead">
        {t.start.lead(seatCount, handsPerSession / seatCount, handsPerSession)}
      </p>

      <button type="button" className="btn btn--primary btn--large" onClick={onStart}>
        {t.start.begin}
      </button>
    </main>
  );
}
