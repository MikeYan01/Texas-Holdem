# Bots decide with Pot Odds, not with a solver

A Bot's decision rule is: estimate the current Equity and compare it against the Pot Odds (call ÷ (pot + call)) — below it, fold; above it, call; far above it, raise. The five personalities are constant offsets on that one comparison (how high the threshold sits, how much margin it takes to escalate to a raise, how wide the preflop entry range is), not five separate pieces of logic.

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

Measured over 6,000 Sessions of the code as it stood, the decision never read the Seat's own Stack or the big blind at all. Both fields sat on the Bot's view, unread, for the life of the project. The consequences were not subtle:

- Bet sizing was a fraction of the pot with no reference to the Stack, so a short Stack's intended bet averaged **5.41 times what it held** and the legal maximum converted it to an all-in. 55.2% of all all-ins came from Stacks under 10 BB, which were 10.0% of decisions. Mean true Equity behind those pushes was 68.8% — not gambling, arithmetic.
- The raising standard before the flop was an even share of the pot plus a margin. Six-handed an even share is 0.167, which is **by definition the Equity of a random Hand**, so a small margin on top said "raise with anything above average".
- And the rule tested "fold if below the calling threshold" *before* "raise if above the raising threshold", while before the flop the calling threshold is the higher of the two. That contradiction held in 54.2% of preflop decisions and threw away 64,583 Hands the same call had just found worth raising — 14.0% of every preflop fold in the game.

A Player watching the Reveal — every Seat's cards face up after every Hand — sees all of that. "Mistakes of this kind are immediately visible to a Player", as this ADR says of absolute thresholds, applies just as much to a Bot that cannot see its own Stack.

The rest of the ADR is unaffected. Personality is still nothing but constants on one shared rule, with **no branch anywhere on which Bot is deciding**, and that is now asserted rather than merely intended.
