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
};

/**
 * A card as a flat, high-contrast symbol rather than a picture of a playing
 * card. At this size a realistic face is less legible, not more.
 */
export function PlayingCard({
  card,
  size = 'hole',
  hidden = false,
  dimmed = false,
  highlighted = false,
  dealIndex = 0,
}: PlayingCardProps) {
  const className = [
    'card',
    `card--${size}`,
    hidden || card === undefined ? 'card--back' : '',
    dimmed ? 'card--dim' : '',
    highlighted ? 'card--win' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style = { animationDelay: `${dealIndex * 90}ms` };

  if (hidden || card === undefined) {
    return <div className={className} style={style} aria-hidden="true" />;
  }

  const rank = RANK_NAMES[rankOf(card)] ?? '?';
  const suit = suitOf(card);

  return (
    <div className={`${className} ${suitIsRed(suit) ? 'card--red' : 'card--black'}`} style={style}>
      <span className="card__rank">{rank}</span>
      <span className="card__suit">{suitSymbol[suit]}</span>
    </div>
  );
}
