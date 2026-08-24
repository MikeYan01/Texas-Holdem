import type { EquityReadout } from '../useGameSession.ts';

/**
 * The Equity readout (issue 11).
 *
 * It says one thing and refuses to say anything else. No "you should fold" —
 * that would need a definition of the correct play, which is a solver's problem
 * and explicitly out of scope. Just the real number, until you start to know what
 * K♠J♠ is worth against five opponents.
 */
export function EquityReadout({ readout }: { readout: EquityReadout }) {
  if (readout.pending) {
    return (
      <div className="equity equity--pending">
        <span className="equity__label">胜率</span>
        <span className="equity__value">计算中…</span>
      </div>
    );
  }
  if (readout.value === null) return null;

  const percent = (readout.value * 100).toFixed(1);
  return (
    <div className="equity">
      <span className="equity__label">胜率</span>
      <span className="equity__value">{percent}%</span>
      <span className="equity__note">对当前仍在局中的 {readout.opponentCount} 名对手</span>
      <div className="equity__bar">
        <div className="equity__fill" style={{ width: `${Math.min(100, readout.value * 100)}%` }} />
      </div>
    </div>
  );
}
