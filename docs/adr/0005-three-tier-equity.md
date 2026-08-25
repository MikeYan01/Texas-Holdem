# Equity is computed in three tiers, not Monte Carlo everywhere

The Equity the Bots and the Player see is computed three different ways, according to the Street:

- **Preflop**: a lookup table. 169 canonical starting hands × opponent count, computed once, offline. **Exact, zero cost**.
- **Flop / turn**: Monte Carlo, **2000 iterations**. Measured at ±1.2% (1σ), 1.43 ms for a single Bot, **7 ms** for all five — inside one frame (16.7 ms).
- **River**: exact enumeration. Each opponent has only C(44,2) = 946 possibilities left, and enumerating all of them is both faster and more accurate than sampling.

The computation runs on the main thread, but the interface is asynchronous (`await getEquity(...)`), so moving it into a Web Worker later is a one-file change rather than a refactor.

## Considered Options

**Monte Carlo everywhere.** Rejected: preflop is the worst case (five board cards still to come) and yet it is entirely pre-enumerable — sampling it accepts error in exchange for time that never had to be spent. And the river's sample space is small enough that enumeration is faster, so sampling there only adds noise.

**Raise the iteration count in pursuit of accuracy.** Rejected: Monte Carlo error falls as 1/√n, so getting from ±1.5% to ±0.15% costs **100×** the time. And a Bot's decision thresholds already carry a personality offset and noise; precision like that is something it cannot consume.

**Use a published starting-hand strength table such as Sklansky-Chubukov.** Rejected: those numbers come from copyrighted books, and transcribing them entry by entry is copying copyrighted material; and several of the repositories carrying that data have no LICENSE file at all (that is, all rights reserved). We have a verified evaluator anyway, so generating those 169 entries ourselves is a one-off script.

**Put it in a Web Worker.** Rejected: 7 ms is well inside budget, and a Bot already sits behind a 600–1200 ms "thinking" delay. Taking on a Worker's serialisation boundary for a performance problem that does not exist is a bad trade — but the asynchronous interface leaves that door open.

## Consequences

The Monte Carlo loop must allocate **nothing per iteration**: a flat `Int32Array` deck, a reused seven-slot hand array, a partial Fisher-Yates that draws only as many cards as it needs. Most of the measured 0.72 µs per iteration is owed to that discipline; written in the idiomatic `[...deck].sort()` style it is an order of magnitude slower. Reference implementation in `.scratch/poker-eval-reference/eq2.js`.

A Bot should not use **true** Equity directly: perfect Equity against a random hand makes a Bot call too often and read as mechanical. The noise the personality parameters impose is also what makes the error of 2000 samples harmless — here, imprecision is not a defect, it is a feature.

Every measured number comes from Node v26.7 / Apple M3 Pro and has **not been verified in a real browser**. V8 is shared with Chrome, but Safari and Firefox are different engines, and this code leans hard on typed arrays. Once it is running for the first time, it should be measured once in the target browsers.

## Correction (found during the v1 implementation)

The figure above — "River: each opponent has only C(44,2) = 946 possibilities left" — is wrong; it is one card short.
Seven cards are known — our own two hole cards plus the five on the board — so the unknown cards number **45**,
and an opponent's possible hole cards number **C(45,2) = 990**. Enumerating on 946 would miss 44 of them.

**The decision itself does not change**: the river still goes through exact enumeration, and 990 over 946 is not expensive enough to reconsider.
The implementation uses 990 — see `src/poker-math/equity-core.ts`.

And one boundary this ADR left unstated: **a multi-way river is not enumerated exactly**.
The joint sample space for n opponents is 990^n, infeasible from two opponents up, so it falls back to Monte Carlo
and says so honestly in the returned `method` field: `monte-carlo`, not `exact-enumeration`.

## Note (after the v1 implementation)

The `.scratch/poker-eval-reference/eq2.js` named above has been deleted. That "no allocation per iteration" style now lives in
`monteCarloEquity` in `src/poker-math/equity-core.ts`, with comments explaining why it has to be written that way.
Measured in the browser (Chromium) it is faster than Node: one computation each for the five Bots totals 6.6 ms, still inside one frame.
