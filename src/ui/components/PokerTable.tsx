import type { Card } from '../../poker-math/cards.ts';
import { displayPots, potForOdds, visibleHoleCards } from '../../engine/selectors.ts';
import type { GameController } from '../useGameSession.ts';
import { potName } from '../text/labels.ts';
import { useLocale } from '../locale-context.tsx';
import { PlayingCard } from './PlayingCard.tsx';
import { SeatBadge } from './SeatBadge.tsx';

/**
 * Where a Seat sits on the felt. The Player is always at the bottom and the rest
 * run clockwise from there, so the table matches the direction the Button moves.
 */
type SeatPosition = React.CSSProperties & {
  readonly '--seat-left': string;
  readonly '--seat-top': string;
  readonly '--seat-left-compact': string;
  readonly '--seat-top-compact': string;
  readonly '--seat-left-landscape': string;
  readonly '--seat-top-landscape': string;
};

function seatPosition(visualIndex: number, seatCount: number): SeatPosition {
  const angle = ((90 + (visualIndex * 360) / seatCount) * Math.PI) / 180;
  const x = Math.cos(angle);
  const y = Math.sin(angle);
  return {
    '--seat-left': `${50 + 41 * x}%`,
    '--seat-top': `${50 + 38 * y}%`,
    '--seat-left-compact': `${50 + 39 * x}%`,
    '--seat-top-compact': `${50 + 39 * y}%`,
    '--seat-left-landscape': `${50 + 43 * x}%`,
    '--seat-top-landscape': `${50 + 36 * y}%`,
  };
}

/**
 * Which side of a Seat its chips sit on: always toward the middle of the table.
 * Seats on the right half of the felt keep theirs on their left, and vice versa.
 */
function chipsSideFor(visualIndex: number, seatCount: number): 'left' | 'right' {
  const angle = 90 + (visualIndex * 360) / seatCount;
  return Math.cos((angle * Math.PI) / 180) > 0.01 ? 'left' : 'right';
}

export function PokerTable({ controller }: { controller: GameController }) {
  const { locale, t } = useLocale();
  const { session, animations, nameOf } = controller;
  const { seats, board, playerSeat, buttonSeat, actorSeat } = session;
  const pots = displayPots(session);
  const middle = potForOdds(session);
  const gathered = pots.reduce((sum, pot) => sum + pot.amount, 0);

  const winners = new Map<number, readonly Card[]>();
  for (const event of session.events) {
    if (event.type !== 'pot-awarded') continue;
    for (const winner of event.winners) winners.set(winner.seat, winner.bestFive ?? []);
  }

  return (
    <div className="felt">
      <div className="felt__rail" aria-hidden="true" />
      <div className="felt__inlay" aria-hidden="true" />
      <div className="felt__sheen" aria-hidden="true" />

      <div className="middle">
        <div className="board">
          {[0, 1, 2, 3, 4].map((i) => (
            <PlayingCard
              key={`${i}-${board[i] ?? 'empty'}`}
              card={board[i]}
              placeholder={board[i] === undefined}
              size="board"
              dealIndex={i}
            />
          ))}
        </div>

        <div className="pots">
          {pots.length === 0 && <div className="pot pot--empty">{t.table.emptyPot}</div>}
          {pots.map((pot, index) => (
            <div key={index} className={`pot ${index > 0 ? 'pot--side' : ''}`}>
              <span className="chip chip--pot" aria-hidden="true" />
              <span className="pot__name">{potName(index, locale)}</span>
              <span className="pot__amount">{pot.amount}</span>
            </div>
          ))}
          {/* What is in the middle once the bets in front of the Seats are
              counted, which is the number pot odds are read off. */}
          {middle > gathered && (
            <div className="pot pot--total">{t.table.middleTotal(middle)}</div>
          )}
        </div>
      </div>

      {seats.map((seat) => {
        const visualIndex = (seat.index - playerSeat + seats.length) % seats.length;
        return (
          <SeatBadge
            key={seat.index}
            seat={seat}
            name={nameOf(seat.index)}
            holeCards={visibleHoleCards(session, seat.index)}
            isButton={seat.index === buttonSeat}
            isActive={session.phase === 'awaiting-action' && seat.index === actorSeat}
            isPlayer={seat.index === playerSeat}
            isWinner={winners.has(seat.index)}
            winningCards={winners.get(seat.index) ?? []}
            style={seatPosition(visualIndex, seats.length)}
            visualIndex={visualIndex}
            chipsSide={chipsSideFor(visualIndex, seats.length)}
          />
        );
      })}

      {/* Chips moving. These answer "where did the money go?", which is the only
          reason they exist — the numbers would otherwise change out of nowhere. */}
      {animations.map((animation) => {
        const visualIndex = (animation.seat - playerSeat + seats.length) % seats.length;
        const position = seatPosition(visualIndex, seats.length);
        return (
          <div
            key={animation.id}
            className={`flying flying--${animation.kind}`}
            style={
              {
                '--seat-x': position['--seat-left'],
                '--seat-y': position['--seat-top'],
              } as React.CSSProperties
            }
          >
            <span className="chip" aria-hidden="true" />
            {animation.amount}
          </div>
        );
      })}
    </div>
  );
}
