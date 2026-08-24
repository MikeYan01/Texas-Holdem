import { rankingByScore } from '../../engine/selectors.ts';
import { scoreOf, type SessionState } from '../../engine/types.ts';

export function ResultsScreen({
  session,
  nameOf,
  onRestart,
}: {
  session: SessionState;
  nameOf: (seat: number) => string;
  onRestart: () => void;
}) {
  const ranked = rankingByScore(session);

  return (
    <main className="screen screen--results">
      <h1 className="screen__title">本局结束</h1>
      <p className="screen__lead">{session.config.handsPerSession} 手打完,按净胜负排名。</p>

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
                {score > 0 ? '+' : ''}
                {score}
              </span>
              <span className="ranking__buyin">补码 {(seat.boughtIn - 200) / 200} 次</span>
            </li>
          );
        })}
      </ol>

      <p className="screen__foot">六个净胜负之和恒为 0,所以名次衡量的是真实发生过的转移。</p>

      <button type="button" className="btn btn--primary btn--large" onClick={onRestart}>
        再来一局
      </button>
    </main>
  );
}
