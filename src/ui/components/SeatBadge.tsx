import type { SeatState } from '../../engine/types.ts';
import { scoreOf } from '../../engine/types.ts';
import type { Card } from '../../poker-math/cards.ts';
import { PlayingCard } from './PlayingCard.tsx';

export type SeatBadgeProps = {
  readonly seat: SeatState;
  readonly name: string;
  readonly blurb: string | null;
  readonly holeCards: readonly [Card, Card] | null;
  readonly isButton: boolean;
  readonly isActive: boolean;
  readonly isPlayer: boolean;
  readonly isWinner: boolean;
  /** The five cards that made the winning hand, to highlight at Reveal. */
  readonly winningCards: readonly Card[];
  /** Where round the felt this Seat sits, as a CSS-ready position. */
  readonly style: React.CSSProperties;
};

const chips = (n: number) => n.toLocaleString('zh-CN');

export function SeatBadge({
  seat,
  name,
  blurb,
  holeCards,
  isButton,
  isActive,
  isPlayer,
  isWinner,
  winningCards,
  style,
}: SeatBadgeProps) {
  const score = scoreOf(seat);
  const className = [
    'seat',
    isActive ? 'seat--active' : '',
    seat.folded ? 'seat--folded' : '',
    isPlayer ? 'seat--player' : '',
    isWinner ? 'seat--winner' : '',
    seat.stack === 0 && !seat.folded ? 'seat--allin' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} style={style}>
      <div className="seat__cards">
        {[0, 1].map((i) => (
          <PlayingCard
            key={i}
            card={holeCards?.[i]}
            hidden={!holeCards}
            size="hole"
            dimmed={seat.folded}
            highlighted={holeCards ? winningCards.includes(holeCards[i]!) : false}
            dealIndex={i}
          />
        ))}
      </div>

      <div className="seat__plate">
        <div className="seat__name">
          {name}
          {isButton && <span className="seat__button" title="Button">D</span>}
        </div>
        {blurb && <div className="seat__blurb">{blurb}</div>}
        <div className="seat__numbers">
          <span className="seat__stack" title="Stack:这手牌面前的筹码">
            码量 {chips(seat.stack)}
          </span>
          <span
            className={`seat__score ${score < 0 ? 'is-down' : score > 0 ? 'is-up' : ''}`}
            title="Score:整局累计净胜负"
          >
            净胜负 {score > 0 ? '+' : ''}
            {chips(score)}
          </span>
        </div>
        {seat.stack === 0 && !seat.folded && <div className="seat__tag">all-in</div>}
        {seat.folded && <div className="seat__tag seat__tag--folded">已弃牌</div>}
      </div>

      {seat.streetCommitted > 0 && (
        <div className="seat__bet" key={seat.streetCommitted}>
          {chips(seat.streetCommitted)}
        </div>
      )}
    </div>
  );
}
