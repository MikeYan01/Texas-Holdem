import { useEffect, useState, type CSSProperties } from 'react';
import type { LegalActions, PlayerAction } from '../../engine/types.ts';
import { useLocale } from '../locale-context.tsx';

export type ActionBarProps = {
  readonly legal: LegalActions | null;
  readonly waiting: boolean;
  readonly onAct: (action: PlayerAction) => void;
};

type SliderStyle = CSSProperties & {
  '--slider-progress-inset': string;
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
  const { t } = useLocale();
  const [raiseTo, setRaiseTo] = useState(0);
  const canSize = Boolean(legal && (legal.canBet || legal.canRaise));

  useEffect(() => {
    if (legal && (legal.canBet || legal.canRaise)) setRaiseTo(legal.minRaiseTo);
  }, [legal]);

  if (!legal) {
    return (
      <div className="actions actions--idle">
        {waiting ? t.actions.waiting : '　'}
      </div>
    );
  }

  const raiseVerb = legal.canBet ? t.actions.bet : t.actions.raiseTo;
  const sliderMax = Math.max(legal.minRaiseTo, legal.maxRaiseTo);
  const progress =
    sliderMax === legal.minRaiseTo
      ? 100
      : Math.min(
          100,
          Math.max(0, ((raiseTo - legal.minRaiseTo) / (sliderMax - legal.minRaiseTo)) * 100),
        );
  const progressText = progress.toFixed(3);
  const sliderStyle: SliderStyle = {
    // The mobile track leaves 8px at each end for the chip-shaped thumb.
    '--slider-progress-inset': `calc(8px + ${progressText}% - ${(progress * 0.16).toFixed(3)}px)`,
  };
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
          {t.actions.fold}
        </button>

        {legal.canCheck ? (
          <button type="button" className="btn btn--call" onClick={() => onAct({ type: 'check' })}>
            {t.actions.check}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn--call"
            disabled={!legal.canCall}
            onClick={() => onAct({ type: 'call' })}
          >
            {t.actions.call(legal.callAmount)}
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
          {t.actions.halfPot(legal.presets.halfPot)}
        </button>
        <button
          type="button"
          className="btn btn--preset"
          disabled={!canSize}
          onClick={() => setRaiseTo(legal.presets.pot)}
        >
          {t.actions.pot(legal.presets.pot)}
        </button>
        <button
          type="button"
          className="btn btn--preset btn--allin"
          disabled={!legal.canAllIn}
          onClick={() => onAct({ type: 'all-in' })}
        >
          {t.actions.allIn(legal.allInTo)}
        </button>

        <input
          type="range"
          className="slider"
          disabled={!canSize}
          min={legal.minRaiseTo}
          max={sliderMax}
          step={1}
          value={raiseTo}
          style={sliderStyle}
          onChange={(event) => setRaiseTo(Number(event.target.value))}
          aria-label={t.actions.sliderLabel}
        />
      </div>
    </div>
  );
}
