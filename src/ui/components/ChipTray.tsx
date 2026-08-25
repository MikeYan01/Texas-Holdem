import { useLocale } from '../locale-context.tsx';
import { formatChips } from '../text/labels.ts';

/** What one chip is worth. 25 is the natural unit at blinds of 2/5. */
const CHIP_VALUE = 25;
/** Chips per row, and rows before the remainder becomes a number. */
const PER_ROW = 8;
const MAX_ROWS = 3;

/**
 * A Seat's Stack, as chips on the felt.
 *
 * Every chip is worth the same, so the block grows with the money. Splitting the
 * Stack into denominations the way a real cage does looks more authentic and
 * destroys the only thing this is for: with 100s and 25s in the pile, a Seat
 * holding 512 shows about as many chips as one holding 63, and the glance that
 * should tell you who is dangerous tells you nothing.
 *
 * Each row steps a colour instead, so a deep Stack still reads as a mixed pile
 * without the count collapsing.
 */
export function ChipTray({ amount, side }: { amount: number; side: 'left' | 'right' }) {
  const { locale } = useLocale();
  if (amount <= 0) return null;

  // Never round a live Stack down to nothing: a Seat with 7 chips left is still
  // in the Hand, and showing an empty space next to it would say otherwise.
  const chips = Math.max(1, Math.round(amount / CHIP_VALUE));

  const rows: number[] = [];
  let left = chips;
  while (left > 0 && rows.length < MAX_ROWS) {
    rows.push(Math.min(left, PER_ROW));
    left -= PER_ROW;
  }

  return (
    <div className={`seat__chips seat__chips--${side}`} aria-hidden="true">
      <div className="chips">
        {rows.map((count, row) => (
          <span key={row} className="chips__row">
            {Array.from({ length: count }, (_, i) => (
              <span key={i} className={`chip chip--t${Math.min(row, 3)}`} />
            ))}
          </span>
        ))}
      </div>
      {left > 0 && <span className="chips__more">+{formatChips(left * CHIP_VALUE, locale)}</span>}
    </div>
  );
}
