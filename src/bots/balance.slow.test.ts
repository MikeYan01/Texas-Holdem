import { describe, expect, it } from 'vitest';
import { measureBalance } from './measure-balance.ts';

// No personality may be a cash machine for the others.
//
// This exists because one was. The original Maniac demanded 4% equity where the
// pot odds asked 20%, so every call it made lost money by construction; it
// shipped 5 BB a hand to the rest of the table and turned four losing styles
// into winners (ADR-0006).
//
// Nothing in the unit tests noticed, and that was not a bug in them: they assert
// the *ordering* of the personalities on purpose, so tuning is not locked down —
// and the ordering was perfectly correct the whole time the table was broken.
// Balance needs its own guard, and it has to be measured rather than reasoned
// about.
//
// The bounds are deliberately loose. They do not pin the balance; they assert
// that nobody is playing a strategy that cannot win.

// Bounds are in big blinds, not chips: chips per Hand quietly rescales the
// moment the blinds change, and a guard whose meaning drifts with the stakes is
// not a guard. The Bot that broke this was at -5.9 BB/hand; the worst is now
// around -0.4.
const WORST_ALLOWED_BB = -2;
const WIDEST_SPREAD_BB = 4;

const results = measureBalance({ sessions: 300 }).balance;

describe('the table is a game, not a donation', () => {
  it('observed a meaningful number of Hands for every personality', () => {
    for (const r of results) expect(r.hands, r.key).toBeGreaterThan(2000);
  });

  it('has nobody haemorrhaging chips to everybody else', () => {
    for (const r of results) {
      expect(r.bbPerHand, `${r.key} loses ${r.bbPerHand.toFixed(3)} BB per Hand`).toBeGreaterThan(
        WORST_ALLOWED_BB,
      );
    }
  });

  it('keeps the whole field within a couple of big blinds of each other', () => {
    const spread = results[0]!.bbPerHand - results[results.length - 1]!.bbPerHand;
    expect(spread, `spread is ${spread.toFixed(3)} BB per Hand`).toBeLessThan(WIDEST_SPREAD_BB);
  });

  it('still adds up to zero, whatever the styles do to each other', () => {
    const total = results.reduce((sum, r) => sum + r.total, 0);
    expect(Math.abs(total)).toBeLessThan(1e-6);
  });
});
