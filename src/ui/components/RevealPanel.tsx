import { evaluateHand } from '../../poker-math/evaluate-hand.ts';
import type { Card } from '../../poker-math/cards.ts';
import type { SessionState } from '../../engine/types.ts';
import { describeHand, kickerNote } from '../text/hand-description.ts';
import { potName, potNote } from '../text/labels.ts';
import { useLocale } from '../locale-context.tsx';
import { PlayingCard } from './PlayingCard.tsx';

/**
 * Reveal (issue 10) — the most instructive thing in the game.
 *
 * Once the Hand is settled, every Seat's cards go face up, including everyone who
 * folded on the flop. This is not Showdown: Showdown is a rule of Hold'em and
 * does not happen every Hand. Reveal always happens, and only ever after the
 * money has already moved, so it cannot influence a decision.
 *
 * The board is repeated here rather than left on the felt behind the panel. Two
 * hole cards on their own say nothing — the whole point is reading them against
 * the five community cards, and a panel that covers those is useless.
 */
export function RevealPanel({
  session,
  nameOf,
  onNext,
}: {
  session: SessionState;
  nameOf: (seat: number) => string;
  onNext: () => void;
}) {
  const { locale, t } = useLocale();
  const kicker = kickerNote(locale);

  // The same order the felt uses: the Player first, then clockwise. Listing them
  // by raw Seat index instead is what made the panel hard to read back against
  // the table — the row of faces had no relationship to the ring you had been
  // watching all Hand.
  const seatsInFeltOrder = session.seats
    .map((seat) => ({
      seat,
      visualIndex:
        (seat.index - session.playerSeat + session.seats.length) % session.seats.length,
    }))
    .sort((a, b) => a.visualIndex - b.visualIndex)
    .map((entry) => entry.seat);
  const awards = session.events.filter((event) => event.type === 'pot-awarded');

  const winningCards = new Map<number, readonly Card[]>();
  const boardCardsThatWon = new Set<Card>();
  for (const award of awards) {
    for (const winner of award.winners) {
      winningCards.set(winner.seat, winner.bestFive ?? []);
      for (const card of winner.bestFive ?? []) {
        if (session.board.includes(card)) boardCardsThatWon.add(card);
      }
    }
  }

  // Not "showdown reached": a river bet that folds everyone out leaves a complete
  // board and no Showdown at all. CONTEXT.md keeps those two apart.
  const boardComplete = session.board.length === 5;

  const finalHand = (hole: readonly [Card, Card] | null): string | null => {
    if (!hole || session.board.length < 3) return null;
    return describeHand(evaluateHand([...hole, ...session.board]), locale);
  };

  return (
    <section className="reveal">
      <header className="reveal__head">
        <h2>{t.reveal.title}</h2>
      </header>

      <div className="reveal__board">
        <span className="reveal__board-label">{t.reveal.boardLabel}</span>
        <div className="reveal__board-cards">
          {[0, 1, 2, 3, 4].map((i) => (
            <PlayingCard
              key={i}
              card={session.board[i]}
              placeholder={session.board[i] === undefined}
              size="board"
              highlighted={
                session.board[i] !== undefined && boardCardsThatWon.has(session.board[i]!)
              }
            />
          ))}
        </div>
        {!boardComplete && (
          <span className="reveal__board-note">
            {t.reveal.boardCutShort(session.board.length === 0)}
          </span>
        )}
      </div>

      <div className="reveal__pots">
        {awards.map((award) => (
          <div
            key={award.potIndex}
            className="reveal__pot"
            title={potNote(award.potIndex, locale)}
          >
            <span className="reveal__pot-name">
              {potName(award.potIndex, locale)} {award.amount}
              <span className="reveal__pot-eligible">
                {t.reveal.eligible(award.eligibleSeats.length)}
              </span>
            </span>
            {award.winners.map((winner) => (
              <span key={winner.seat} className="reveal__winner" title={kicker}>
                {nameOf(winner.seat)} +{winner.amount}
                {winner.handValue !== null && ` (${describeHand(winner.handValue, locale)})`}
              </span>
            ))}
            {award.oddChipSeat !== null && (
              <span className="reveal__odd">{t.reveal.oddChip(nameOf(award.oddChipSeat))}</span>
            )}
          </div>
        ))}
      </div>

      <div className="reveal__seats">
        {seatsInFeltOrder.map((seat) => {
          const winning = winningCards.get(seat.index);
          const made = finalHand(seat.holeCards);
          return (
            <div
              key={seat.index}
              className={`reveal__seat ${winning ? 'is-winner' : ''} ${seat.folded ? 'is-folded' : ''}`}
            >
              <div className="reveal__seat-name">
                {nameOf(seat.index)}
                {seat.folded && <span className="reveal__folded">{t.reveal.folded}</span>}
              </div>
              <div className="reveal__seat-cards">
                {(seat.holeCards ?? []).map((card, i) => (
                  <PlayingCard
                    key={i}
                    card={card}
                    size="mini"
                    // Only the winner's cards. Ringing everyone's own best five
                    // made every Seat look like it had won.
                    highlighted={winning?.includes(card) ?? false}
                  />
                ))}
              </div>
              {made && (
                <div className="reveal__made" title={kicker}>
                  {made}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button type="button" className="btn btn--primary" onClick={onNext}>
        {t.reveal.next}
      </button>
    </section>
  );
}
