import type { Card } from '../../poker-math/cards.ts';
import { rankOf, suitOf } from '../../poker-math/cards.ts';
import { RANK_NAMES } from '../text/hand-description.ts';
import { suitIsRed, suitSymbol } from '../text/labels.ts';

export type PlayingCardProps = {
  readonly card?: Card | undefined;
  readonly size?: 'board' | 'hole' | 'mini';
  /** Face down: the back is all a Bot's cards ever show during a Hand. */
  readonly hidden?: boolean;
  readonly dimmed?: boolean;
  /** Part of the five cards that actually made a winning hand. */
  readonly highlighted?: boolean;
  readonly dealIndex?: number;
  /**
   * Render an empty outline rather than a card back. Hold'em has no face-down
   * community card, so a board slot still to come must not look like one.
   */
  readonly placeholder?: boolean;
};

/**
 * A card face: a corner index and a centre pip, the way a real deck is laid out.
 *
 * Still flat symbols rather than a picture of a card — at this size a realistic
 * face is less legible, not more — but the corner index is what makes a fanned
 * hand readable, and it costs nothing.
 */
export function PlayingCard({
  card,
  size = 'hole',
  hidden = false,
  dimmed = false,
  highlighted = false,
  dealIndex = 0,
  placeholder = false,
}: PlayingCardProps) {
  if (placeholder && card === undefined) {
    return <div className={`card card--${size} card--slot`} aria-hidden="true" />;
  }
  const faceDown = hidden || card === undefined;
  const className = [
    'card',
    `card--${size}`,
    faceDown ? 'card--back' : '',
    dimmed ? 'card--dim' : '',
    highlighted ? 'card--win' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style = { animationDelay: `${dealIndex * 80}ms` };

  if (faceDown) {
    return (
      <div className={className} style={style} aria-hidden="true">
        <span className="card__weave" />
      </div>
    );
  }

  const rank = RANK_NAMES[rankOf(card)] ?? '?';
  const suit = suitOf(card);
  const pip = suitSymbol[suit];

  return (
    <div
      className={`${className} ${suitIsRed(suit) ? 'card--red' : 'card--black'}`}
      style={style}
      aria-label={`${rank}${pip}`}
    >
      <span className="card__corner">
        <span className="card__rank">{rank}</span>
        <span className="card__suit">{pip}</span>
      </span>
      <span className="card__pip" aria-hidden="true">
        {pip}
      </span>
    </div>
  );
}
