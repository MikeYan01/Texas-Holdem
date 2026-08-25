# Stack and Score are two different concepts

The ranking has to rest on a cumulative net win/loss that may go negative (a Seat that loses everything should not be kicked off the table), while the ceiling on a bet has to be finite (otherwise No-Limit Hold'em falls apart). Squeezing both into one "chips" number dismantles the game itself, so there are two words instead: **Stack** is the finite chips a Seat has in front of it for the current Hand, and it defines the all-in ceiling and the Side Pots; **Score** is the cumulative net win/loss over the whole Session, may be negative, and is the sole basis for the final ranking. A Stack that reaches zero Rebuys automatically, and whatever the Stack goes up by, that Seat's Score goes down by exactly the same amount.

## Considered Options

**Keep only one score, let it go negative, and play on after busting.** Rejected, because it takes three things apart in a chain:

1. **all-in loses its definition.** all-in means "push in everything I have"; with no floor under the score there is no "everything", and betting has no upper bound.
2. **Side Pots never form.** The only reason a Side Pot exists is that a short Stack cannot cover a large bet; let everyone overdraw without limit and there is only ever a main pot.
3. **Bluffing loses its teeth.** Calling no longer consumes any finite resource, and the optimal strategy degenerates into "always call to Showdown".

## Consequences

The six Seats' Scores sum to zero at every moment. That is an invariant that can be asserted directly at the end of every Hand, and it is the most valuable property in the engine's tests.

Rebuys are uncapped, so nobody is ever knocked out and leaves the table: all six Seats have someone in them for all eighteen Hands. The price is that a Seat that goes broke over and over sits on a deeply negative Score — that is an honest measurement, not a defect.
