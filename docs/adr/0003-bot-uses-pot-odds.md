# Bots decide with Pot Odds, not with a solver

A Bot compares its estimated Equity against Pot Odds (call ÷ (pot + call)) to decide whether calling is worthwhile. Raising uses an Opening Range before the flop and an Equity threshold after it. The five personalities supply constants to this shared rule, not five separate pieces of logic.

## Considered Options

**An absolute Equity threshold**, say "fold below 40%". Rejected: it ignores the size of the pot. With 100 already in the pot and only 2 to call, about 2% Equity is enough to make calling correct, and an absolute threshold throws that pot away. Mistakes of this kind are **immediately visible** to a Player, and within a few Hands they make the Bot look stupid.

**A solver-based approximate GTO strategy** (CFR, hand abstraction, opponent range modelling). Rejected: that is research-grade engineering and it would swallow the whole project. What this project wants is one fun standalone Session, not a strong AI.

## Consequences

A Bot is rational on the **calling** side, but its **bet sizing** and its **bluff frequency** are driven by personality constants alone, with no game-theoretic basis at all. They play like an amateur who knows basic odds — which is exactly the opponent this project wants.

Do not treat this as a defect and "fix" it: fixing it means rebuilding the project into a solver, and that is the road this ADR explicitly rejects.

## Amendment: situational awareness is not a solver (found while fixing Bot decision quality)

The prohibition above stands, unchanged: **no counterfactual regret minimisation, no hand abstraction, no opponent range modelling.** It is narrowed, not overturned.

What it no longer forbids is a Bot consulting information **it already legitimately holds**:

- its own Stack depth, and the effective Stack against the largest opponent still in;
- its own Position, derived from the Button and the set of unfolded Seats;
- its own Hand's **Upside** — the probability of finishing with a straight or better;
- which Seat led the betting on the previous Street.

Every one of those is either the Bot's own two cards, its own chips, where it is sitting, or something every Seat at the table watched happen. None of it is a model of what anybody else holds, which is the line this ADR draws.

The instruction not to "fix" the absence of a game-theoretic basis is limited **explicitly to bet sizing and bluff frequency**. It never meant that a Bot should be blind to the situation in front of it, and read that way it had a cost that turned out to be very large.

The original decision ignored Stack depth, used an even-share Equity threshold to open before the flop, and could fold a Hand it had just found strong enough to raise. [ADR-0009](0009-measurement-closed-two-roads.md) records the measurements and why these were corrected with stack-aware sizing and a price-sensitive Opening Range, rather than deeper Stacks or a change of branch order alone.

The rest of the ADR is unaffected. Personality is still nothing but constants on one shared rule, with **no branch anywhere on which Bot is deciding**, and that is now asserted rather than merely intended.
