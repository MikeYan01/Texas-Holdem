import { rankingByScore, rebuyCount } from '../../engine/selectors.ts';
import { scoreOf, type SessionState } from '../../engine/types.ts';
import { formatScore } from '../text/labels.ts';
import { useLocale } from '../locale-context.tsx';

export function ResultsScreen({
  session,
  nameOf,
  onRestart,
}: {
  session: SessionState;
  nameOf: (seat: number) => string;
  onRestart: () => void;
}) {
  const { locale, t } = useLocale();
  const ranked = rankingByScore(session);
  const playerPlace = ranked.findIndex((seat) => seat.index === session.playerSeat);
  const playerScore = scoreOf(ranked[playerPlace]!);

  return (
    <main className="screen screen--results">
      <span className="results__emblem" aria-hidden="true">♠</span>
      <p className="eyebrow">{t.results.eyebrow}</p>
      <h1 className="screen__title">{t.results.title}</h1>
      <p className="screen__lead">{t.results.lead(session.config.handsPerSession)}</p>

      <div className="results__summary">
        <div>
          <span className="results__label">{t.results.yourPlace}</span>
          <strong className="results__value">{t.results.place(playerPlace + 1, ranked.length)}</strong>
        </div>
        <div>
          <span className="results__label">{t.results.yourScore}</span>
          <strong className={`results__value ${playerScore < 0 ? 'is-down' : playerScore > 0 ? 'is-up' : ''}`}>
            {formatScore(playerScore, locale)}
          </strong>
        </div>
      </div>

      <ol className="ranking">
        {ranked.map((seat, place) => {
          const score = scoreOf(seat);
          return (
            <li
              key={seat.index}
              className={`ranking__row ${seat.index === session.playerSeat ? 'is-player' : ''}`}
            >
              <span className="ranking__place">{place + 1}</span>
              <span className="ranking__name">{nameOf(seat.index)}</span>
              <span className={`ranking__score ${score < 0 ? 'is-down' : score > 0 ? 'is-up' : ''}`}>
                {formatScore(score, locale)}
              </span>
              <span className="ranking__buyin">
                {t.results.rebuys(rebuyCount(seat, session.config))}
              </span>
            </li>
          );
        })}
      </ol>

      <button type="button" className="btn btn--primary btn--large" onClick={onRestart}>
        {t.results.restart}
      </button>
    </main>
  );
}
