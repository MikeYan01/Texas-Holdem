import type { Card } from '../../poker-math/cards.ts';
import { displayPots, potForOdds, visibleHoleCards } from '../../engine/selectors.ts';
import type { GameController } from '../useGameSession.ts';
import { PERSONALITY_BLURBS, potName } from '../text/labels.ts';
import { PlayingCard } from './PlayingCard.tsx';
import { SeatBadge } from './SeatBadge.tsx';

/**
 * Where a Seat sits on the felt. The Player is always at the bottom and the rest
 * run clockwise from there, so the table matches the direction the Button moves.
 */
function seatPosition(visualIndex: number, seatCount: number): React.CSSProperties {
  const angle = ((90 + (visualIndex * 360) / seatCount) * Math.PI) / 180;
  return {
    left: `${50 + 41 * Math.cos(angle)}%`,
    top: `${50 + 38 * Math.sin(angle)}%`,
  };
}

export function PokerTable({ controller }: { controller: GameController }) {
  const { session, animations, nameOf, seating } = controller;
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
          {pots.length === 0 && <div className="pot pot--empty">底池 0</div>}
          {pots.map((pot, index) => (
            <div key={index} className={`pot ${index > 0 ? 'pot--side' : ''}`}>
              <span className="chip chip--pot" aria-hidden="true" />
              <span className="pot__name">{potName(index)}</span>
              <span className="pot__amount">{pot.amount}</span>
            </div>
          ))}
          {/* What is in the middle once the bets in front of the Seats are
              counted, which is the number pot odds are read off. */}
          {middle > gathered && <div className="pot pot--total">总计 {middle}</div>}
        </div>
      </div>

      {seats.map((seat) => {
        const visualIndex = (seat.index - playerSeat + seats.length) % seats.length;
        const key = seating.get(seat.index);
        return (
          <SeatBadge
            key={seat.index}
            seat={seat}
            name={nameOf(seat.index)}
            blurb={key ? PERSONALITY_BLURBS[key] : '本人'}
            holeCards={visibleHoleCards(session, seat.index)}
            isButton={seat.index === buttonSeat}
            isActive={session.phase === 'awaiting-action' && seat.index === actorSeat}
            isPlayer={seat.index === playerSeat}
            isWinner={winners.has(seat.index)}
            winningCards={winners.get(seat.index) ?? []}
            style={seatPosition(visualIndex, seats.length)}
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
                '--seat-x': position.left,
                '--seat-y': position.top,
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
