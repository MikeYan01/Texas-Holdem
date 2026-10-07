# Pure front-end, no backend; the rules engine is completely separate from rendering

This game is standalone: one Player against five Bots driven by fixed heuristics, virtual scoring, no human opponent. So the whole game runs inside the browser as a static site — no server, no accounts, no network protocol. As a hard constraint, the rules engine must be a zero-dependency pure TypeScript module: it imports no UI framework, touches no DOM, touches no `window`, makes no network requests. React only subscribes to the state the engine emits.

## Considered Options

**A thin Node backend holding the deck.** Rejected: when there is no opponent who could be cheated, it adds deployment, state-synchronisation and latency costs and buys nothing in return.

## Consequences

The deck and every Bot's hole cards live in client memory; open devtools and you can see them. In a standalone Session that costs nothing, but it means this code is unsafe in any setting that has **a human opponent**. The engine's purity is the door left open for exactly that: if play against real people is added later, the way to do it is to lift the same engine module onto Node as-is and let it be the authoritative state machine, not to rewrite it.

Keeping IO out of the engine buys something today as well: it can be tested in bulk under Node — a hundred thousand Hands to verify the zero-sum invariant, no browser needed.
