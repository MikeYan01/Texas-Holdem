import type { SeatState } from '../../engine/types.ts';
import { scoreOf } from '../../engine/types.ts';
import type { Card } from '../../poker-math/cards.ts';
import { formatChips, formatScore } from '../text/labels.ts';
import { useLocale } from '../locale-context.tsx';
import { ChipTray } from './ChipTray.tsx';
import { PlayingCard } from './PlayingCard.tsx';

export type SeatBadgeProps = {
  readonly seat: SeatState;
  readonly name: string;
  readonly holeCards: readonly [Card, Card] | null;
  readonly isButton: boolean;
  readonly isActive: boolean;
  readonly isPlayer: boolean;
  readonly isWinner: boolean;
  /** The five cards that made the winning hand, to highlight at Reveal. */
  readonly winningCards: readonly Card[];
  /** Where round the felt this Seat sits, as a CSS-ready position. */
  readonly style: React.CSSProperties;
  /** Clockwise position from the Player, used only to place compact-screen bets inward. */
  readonly visualIndex: number;
  /**
   * Which side of the plate the chips sit on. Always the inward side: the felt
   * leaves only about 50px between a side Seat and the rail, and several hundred
   * toward the middle — which is also where a real player keeps their chips.
   */
  readonly chipsSide: 'left' | 'right';
};

export function SeatBadge({
  seat,
  name,
  holeCards,
  isButton,
  isActive,
  isPlayer,
  isWinner,
  winningCards,
  style,
  visualIndex,
  chipsSide,
}: SeatBadgeProps) {
  const { locale, t } = useLocale();
  const chips = (amount: number) => formatChips(amount, locale);
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
    <div className={className} style={style} data-visual-index={visualIndex}>
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
          <span className="seat__name">{name}</span>
          {isButton && (
            <span className="seat__button" title={t.seat.buttonNote}>
              D
            </span>
          )}
        </div>

        <div className="seat__numbers">
          <span className="seat__stat" title={t.seat.stackNote}>
            <span className="seat__stat-label">{t.seat.stackLabel}</span>
            <span className="seat__stack">{chips(seat.stack)}</span>
          </span>
          <span className="seat__stat" title={t.seat.scoreNote}>
            <span className="seat__stat-label">{t.seat.scoreLabel}</span>
            <span className={`seat__score ${score < 0 ? 'is-down' : score > 0 ? 'is-up' : ''}`}>
              {formatScore(score, locale)}
            </span>
          </span>
        </div>

        <ChipTray amount={seat.stack} side={chipsSide} />

        {allIn && <span className="seat__tag seat__tag--allin">all-in</span>}
        {seat.folded && <span className="seat__tag seat__tag--folded">{t.seat.folded}</span>}
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
