import { useEffect, useState } from 'react';
import type { LegalActions, PlayerAction } from '../../engine/types.ts';

export type ActionBarProps = {
  readonly legal: LegalActions | null;
  readonly waiting: boolean;
  readonly onAct: (action: PlayerAction) => void;
};

/**
 * The three buttons everyone expects, three ready-made sizings and a slider.
 *
 * Not one amount in here is worked out locally: the minimum raise, the call, the
 * cap and all three presets arrive on `legal` from the engine, because they are
 * rules and rules belong inside the test seam (ADR-0001). There is also no
 * countdown, deliberately — think as long as you like.
 */
export function ActionBar({ legal, waiting, onAct }: ActionBarProps) {
  const [raiseTo, setRaiseTo] = useState(0);
  const canSize = Boolean(legal && (legal.canBet || legal.canRaise));

  useEffect(() => {
    if (legal && (legal.canBet || legal.canRaise)) setRaiseTo(legal.minRaiseTo);
  }, [legal]);

  if (!legal) {
    return (
      <div className="actions actions--idle">
        {waiting ? '等待其他 Seat 行动…' : '　'}
      </div>
    );
  }

  const raiseVerb = legal.canBet ? '下注' : '加注到';
  const submitRaise = (to: number) => {
    if (to >= legal.maxRaiseTo && legal.canAllIn) return onAct({ type: 'all-in' });
    onAct(legal.canBet ? { type: 'bet', to } : { type: 'raise', to });
  };

  return (
    <div className="actions">
      <div className="actions__row">
        <button
          type="button"
          className="btn btn--fold"
          disabled={!legal.canFold}
          onClick={() => onAct({ type: 'fold' })}
        >
          弃牌
        </button>

        {legal.canCheck ? (
          <button type="button" className="btn btn--call" onClick={() => onAct({ type: 'check' })}>
            过牌
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--call"
            disabled={!legal.canCall}
            onClick={() => onAct({ type: 'call' })}
          >
            跟注 {legal.callAmount}
          </button>
        )}

        <button
          type="button"
          className="btn btn--raise"
          disabled={!canSize}
          onClick={() => submitRaise(raiseTo)}
        >
          {raiseVerb} {canSize ? raiseTo : '—'}
        </button>
      </div>

      <div className="actions__row actions__row--sizing">
        <button
          type="button"
          className="btn btn--preset"
          disabled={!canSize}
          onClick={() => setRaiseTo(legal.presets.halfPot)}
        >
          1/2 池 {legal.presets.halfPot}
        </button>
        <button
          type="button"
          className="btn btn--preset"
          disabled={!canSize}
          onClick={() => setRaiseTo(legal.presets.pot)}
        >
          满池 {legal.presets.pot}
        </button>
        <button
          type="button"
          className="btn btn--preset btn--allin"
          disabled={!legal.canAllIn}
          onClick={() => onAct({ type: 'all-in' })}
        >
          All-in {legal.allInTo}
        </button>

        <input
          type="range"
          className="slider"
          disabled={!canSize}
          min={legal.minRaiseTo}
          max={Math.max(legal.minRaiseTo, legal.maxRaiseTo)}
          step={1}
          value={raiseTo}
          onChange={(event) => setRaiseTo(Number(event.target.value))}
          aria-label="加注额"
        />
      </div>
    </div>
  );
}
