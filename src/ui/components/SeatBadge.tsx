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
  const allIn = seat.stack === 0 && !seat.folded;
  const className = [
    'seat',
    isActive ? 'seat--active' : '',
    seat.folded ? 'seat--folded' : '',
    isPlayer ? 'seat--player' : '',
    isWinner ? 'seat--winner' : '',
    allIn ? 'seat--allin' : '',
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
        {isActive && <span className="seat__ring" aria-hidden="true" />}
        <div className="seat__identity">
          <span className="seat__avatar" aria-hidden="true">
            {isPlayer ? '★' : name.slice(0, 1)}
          </span>
          <span className="seat__who">
            <span className="seat__name">{name}</span>
            {blurb && <span className="seat__blurb">{blurb}</span>}
          </span>
          {isButton && (
            <span className="seat__button" title="Button">
              D
            </span>
          )}
        </div>

        <div className="seat__numbers">
          <span className="seat__stat" title="Stack:这手牌面前的筹码">
            <span className="seat__stat-label">码量</span>
            <span className="seat__stack">{chips(seat.stack)}</span>
          </span>
          <span className="seat__stat" title="Score:整局累计净胜负">
            <span className="seat__stat-label">净胜负</span>
            <span className={`seat__score ${score < 0 ? 'is-down' : score > 0 ? 'is-up' : ''}`}>
              {score > 0 ? '+' : ''}
              {chips(score)}
            </span>
          </span>
        </div>

        {allIn && <span className="seat__tag seat__tag--allin">all-in</span>}
        {seat.folded && <span className="seat__tag seat__tag--folded">已弃牌</span>}
      </div>

      {seat.streetCommitted > 0 && (
        <div className="seat__bet" key={seat.streetCommitted}>
          <span className="chip" aria-hidden="true" />
          {chips(seat.streetCommitted)}
        </div>
      )}
    </div>
  );
}
