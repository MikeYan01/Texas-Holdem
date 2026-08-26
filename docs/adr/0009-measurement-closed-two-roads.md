# Two roads measurement closed: deeper Stacks, and correcting the fold/raise inversion alone

Both of these look obviously right on paper. Both were built and measured at full scale, and both are worse than doing nothing. They are recorded here because each is hard to reverse once balance has been retuned around it, each is surprising without the numbers, and each was a genuine trade-off rather than a mistake.

The starting Stack stays at **20 BB**, and the preflop fold/raise contradiction was corrected **together with** an Opening Range, never alone.

## Deepening the Stacks does not open up the table

The Bots played an almost entirely heads-up game: mean live Seats at the flop **2.02**, with 97.9% of flops two-handed and multiway pots effectively nonexistent. The obvious cause looked like Stack depth — 20 BB is shallow, everyone is committed early, so nobody can afford to see a flop three-handed.

Measured at 100 BB instead of 20, over the same experiment:

| | 20 BB | 100 BB |
| --- | --- | --- |
| mean live Seats at the flop | 2.02 | **2.02** |
| two-handed flops | 97.9% | **98.3%** |
| all-ins per Session | 3.13 | 1.92 |
| Rebuys per 100 Hands | 14.11 | 7.69 |
| field spread, BB per Hand | 0.337 | **1.468** |
| short Stack's intended bet, as a multiple of its Stack | 5.41x | **10.97x** |

The table got **more** heads-up, not less. Showdowns fell. The spread across the five personalities blew out by more than four times, flipping both aggressive styles into losers, which would have meant retuning every personality constant around the new depth.

And it made the thing it was supposed to fix worse. A short Stack's intended bet went from 5.41 times its Stack to 10.97 times, because deep opponents build bigger pots and the sizing rule read the pot alone. Depth removes the *exposure* to short Stacks without making short-Stack play any better; the moment a Seat is short again, it is short in a bigger pot.

What actually opened the table up was giving the Bots an entry standard that means something — mean live Seats at the flop 2.02 → 2.07 and three-handed flops 2.1% → 6.7% — and what fixed the sizing was reading the Stack, which costs nothing in balance.

## Correcting the fold/raise contradiction on its own makes the game worse

The decision tested "is my Equity below my calling threshold, if so fold" *before* it tested "is my Equity above my raising threshold". Before the flop the calling threshold is the higher of the two — TAG needs 0.557 Equity to call when first in and 0.267 to raise — so a Hand strong enough to raise was folded instead. The inversion held in **54.2% of all preflop decisions** and caused **64,583 wrong folds, 14.0% of every preflop fold in the game**, at a mean true Equity of 29.0%.

It is plainly a bug. Correcting the ordering and nothing else:

| | before | after the ordering fix alone |
| --- | --- | --- |
| all-ins per Session | 3.13 | **5.60** (+79%) |
| Rebuys per 100 Hands | 14.11 | **27.4** (+94%, a Seat busting every 3.6 Hands) |
| bluff share of aggression | 22.0% | **13.3%** |
| bluff-driven actions, absolute | — | **-14.5%** |

Both of the Player's complaints got worse — fewer bluffs, and more reckless-looking pushes.

The reason is that **the contradiction had been serving as the real entry gate all along**. The raising standard underneath it was an even share of the pot plus a margin, and six-handed an even share is 0.167, which is by definition the Equity of a random Hand. Remove the gate in isolation and the loosest aggressive personality's preflop opening rate goes from 20.1% to **49.9%**: it raises half of all Hands.

So the correction ships with a real preflop entry standard, and only with one. An Opening Range replaces the even-share form before the flop, and the two changes landed in a single commit for exactly this reason.

## Consequences

The 20 BB Stack is now load-bearing in a way it was not before. Short-Stack play is addressed by stack-aware bet sizing and by an Upside-driven push a Bot chooses, rather than by removing the Bots' exposure to being short — which is the more interesting game anyway, since a short Stack is a decision and a deep one is mostly a delay.

Rebuys have risen to 23.1 per 100 Hands, which is about four a Session against two and a half. That is the cost of a table that now bets. It was measured against smaller bets, tighter opening ranges and a lower Stack-commitment ceiling, and none of them bought it back without giving up the aggression the change existed to add.

If either road is proposed again, the numbers above were produced by the one experiment in `src/bots/measure-balance.ts`, which is also what `npm run measure:bots` prints and what `balance.slow.test.ts` guards (ADR-0006).
