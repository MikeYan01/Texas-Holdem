# Bots decide with Pot Odds, not with a solver

A Bot's decision rule is: estimate the current Equity and compare it against the Pot Odds (call ÷ (pot + call)) — below it, fold; above it, call; far above it, raise. The five personalities are constant offsets on that one comparison (how high the threshold sits, how much margin it takes to escalate to a raise, how wide the preflop entry range is), not five separate pieces of logic.

## Considered Options

**An absolute Equity threshold**, say "fold below 40%". Rejected: it ignores the size of the pot. With 100 already in the pot and only 2 to call, about 2% Equity is enough to make calling correct, and an absolute threshold throws that pot away. Mistakes of this kind are **immediately visible** to a Player, and within a few Hands they make the Bot look stupid.

**A solver-based approximate GTO strategy** (CFR, hand abstraction, opponent range modelling). Rejected: that is research-grade engineering and it would swallow the whole project. What this project wants is one fun standalone Session, not a strong AI.

## Consequences

A Bot is rational on the **calling** side, but its **bet sizing** and its **bluff frequency** are driven by personality constants alone, with no game-theoretic basis at all. They play like an amateur who knows basic odds — which is exactly the opponent this project wants.

Do not treat this as a defect and "fix" it: fixing it means rebuilding the project into a solver, and that is the road this ADR explicitly rejects.
