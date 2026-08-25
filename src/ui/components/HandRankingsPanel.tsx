import { parseCards } from '../../poker-math/cards.ts';
import { HandCategory } from '../../poker-math/evaluate-hand.ts';
import { categoryName } from '../text/hand-description.ts';
import { useLocale } from '../locale-context.tsx';
import { PlayingCard } from './PlayingCard.tsx';

/**
 * One worked example per category, strongest first.
 *
 * Real cards rather than prose, because "three of one rank and two of another"
 * is a definition and `Q♥ Q♦ Q♠ 4♣ 4♦` is the thing itself. The straight flush
 * deliberately shows the royal, which is the one every beginner has heard of.
 */
const EXAMPLES: ReadonlyArray<readonly [HandCategory, string]> = [
  [HandCategory.StraightFlush, 'As Ks Qs Js Ts'],
  [HandCategory.Quads, '9h 9d 9s 9c Kd'],
  [HandCategory.FullHouse, 'Qh Qd Qs 4c 4d'],
  [HandCategory.Flush, 'Ad Jd 8d 5d 3d'],
  [HandCategory.Straight, '9c 8d 7h 6s 5d'],
  [HandCategory.Trips, '7h 7d 7s Kc 2d'],
  [HandCategory.TwoPair, 'Ah Ad 8s 8c Qd'],
  [HandCategory.Pair, 'Th Td As 7c 4d'],
  [HandCategory.HighCard, 'As Qd 9h 6c 3d'],
];

/**
 * The rules reference, for players who have not met a full house before.
 *
 * It lives behind a link rather than on the felt: it is worth reading once and
 * then never again, which is exactly what a dialog is for.
 */
export function HandRankingsPanel({ onClose }: { onClose: () => void }) {
  const { locale, t } = useLocale();

  return (
    <section className="rankings" role="dialog" aria-label={t.rankings.title}>
      <header className="rankings__head">
        <h2>{t.rankings.title}</h2>
        <p>{t.rankings.lead}</p>
      </header>

      <ol className="rankings__list">
        {EXAMPLES.map(([category, cards], index) => (
          <li key={category} className="rankings__row">
            <span className="rankings__place">{index + 1}</span>
            <span className="rankings__name">{categoryName(category, locale)}</span>
            <span className="rankings__cards">
              {parseCards(cards).map((card) => (
                <PlayingCard key={card} card={card} size="mini" />
              ))}
            </span>
            <span className="rankings__note">{t.rankings.notes[category]}</span>
          </li>
        ))}
      </ol>

      <button type="button" className="btn btn--primary" onClick={onClose}>
        {t.rankings.close}
      </button>
    </section>
  );
}
