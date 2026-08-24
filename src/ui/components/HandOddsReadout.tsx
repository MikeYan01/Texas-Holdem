import { HandCategory } from '../../poker-math/evaluate-hand.ts';
import type { CategoryChance, HandOdds } from '../../poker-math/hand-odds.ts';
import { CATEGORY_NAMES } from '../text/hand-description.ts';

export type HandOddsReadoutProps = {
  readonly odds: HandOdds | null;
  readonly top: readonly CategoryChance[];
  /** What the Seat holds right now, or null before the flop. */
  readonly madeNow: HandCategory | null;
};

const percent = (value: number): string => {
  if (value >= 0.1) return `${(value * 100).toFixed(1)}%`;
  if (value >= 0.001) return `${(value * 100).toFixed(2)}%`;
  return '<0.1%';
};

/**
 * What you are likely to end up holding.
 *
 * About your own cards only — no opponents in it at all — and exact everywhere:
 * preflop from an exhaustively enumerated table, and after that by counting every
 * remaining run-out. There is no error bar on any of these numbers.
 *
 * It does not judge the decision. That would need a definition of the correct
 * play, which is a solver's problem and out of scope.
 */
export function HandOddsReadout({ odds, top, madeNow }: HandOddsReadoutProps) {
  if (!odds) return <div className="odds odds--idle" />;

  const strongest = top[0]?.probability ?? 1;

  return (
    <div className="odds">
      <div className="odds__head">
        <span className="odds__title">成牌概率</span>
      </div>
      <div className="odds__context">
        {madeNow === null ? '翻牌前' : `当前 ${CATEGORY_NAMES[madeNow]}`}
        {odds.cardsToCome > 0 ? ` · 还有 ${odds.cardsToCome} 张公共牌` : ' · 已定型'}
      </div>

      <ol className="odds__list">
        {top.map((entry) => (
          <li key={entry.category} className="odds__row">
            <span className="odds__name">{CATEGORY_NAMES[entry.category]}</span>
            <span className="odds__bar">
              <span
                className="odds__fill"
                style={{ width: `${(entry.probability / strongest) * 100}%` }}
              />
            </span>
            <span className="odds__value">{percent(entry.probability)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
