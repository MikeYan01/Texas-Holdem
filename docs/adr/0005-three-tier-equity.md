# Equity is computed in three tiers, not Monte Carlo everywhere

Equity is used by the Bots, not displayed to the Player; the interface shows Hand Odds instead (ADR-0007). The method depends on the Street and opponent count:

- **Preflop**: a lookup table covering 169 canonical starting hands against one to five opponents. Each cell is generated offline with **200,000 seeded Monte Carlo iterations**, with worst-case sampling error of about **0.11% (1σ)**. Runtime lookup is deterministic and cheap, not mathematically exact. More than five opponents falls back to live sampling.
- **Flop / turn**: Monte Carlo, **2000 iterations**. Measured at ±1.2% (1σ), 1.43 ms for a single Bot, **7 ms** for all five — inside one frame (16.7 ms).
- **Heads-up river**: exact enumeration of **C(45,2) = 990** opponent holdings. Our two hole cards and five community cards leave 45 unknown cards.
- **Multi-way river**: Monte Carlo, **2000 iterations**. The joint space of disjoint opponent holdings is too large to enumerate live.

The returned `method` names the computation that actually ran. Work runs on the main thread, but the interface remains asynchronous (`await getEquity(...)`) so a future Worker adapter need not change its callers.

## Considered Options

**Live Monte Carlo everywhere.** Rejected: preflop has the largest sample space, but repeated holdings can share an offline lookup rather than paying for new samples at every decision. The heads-up river's sample space is small enough that enumeration is faster, so sampling there only adds noise.

**Raise the iteration count in pursuit of accuracy.** Rejected: Monte Carlo error falls as 1/√n, so getting from ±1.5% to ±0.15% costs **100×** the time. And a Bot's decision thresholds already carry a personality offset and noise; precision like that is something it cannot consume.

**Use a published starting-hand strength table such as Sklansky-Chubukov.** Rejected: those numbers come from copyrighted books, and transcribing them entry by entry is copying copyrighted material; and several of the repositories carrying that data have no LICENSE file at all (that is, all rights reserved). We have a verified evaluator anyway, so generating those 169 entries ourselves is a one-off script.

**Put it in a Web Worker.** Rejected: the measured work is inside budget, and a Bot already sits behind a deliberate thinking delay. Taking on Worker serialisation for a performance problem that does not exist is a bad trade, but the asynchronous interface leaves that door open.

## Consequences

The Monte Carlo loop must allocate **nothing per iteration**: a flat `Int32Array` deck, a reused seven-slot hand array, a partial Fisher-Yates that draws only as many cards as it needs. Most of the measured 0.72 µs per iteration is owed to that discipline; written in the idiomatic `[...deck].sort()` style it is an order of magnitude slower. The implementation is `monteCarloEquity` in `src/poker-math/equity-core.ts`.

A Bot should not use **true** Equity directly: perfect Equity against a random hand makes a Bot call too often and read as mechanical. The noise the personality parameters impose is also what makes the error of 2000 samples harmless — here, imprecision is not a defect, it is a feature.

The original measurements used Node v26.7 on an Apple M3 Pro. A subsequent Chromium measurement put one computation for each of the five Bots at 6.6 ms total. Safari and Firefox have not been measured; their different engines should not be assumed to share those timings.

## Implementation corrections

The original design incorrectly called the preflop lookup exact and counted only 946 river holdings; it also omitted the multi-way fallback. The method descriptions above reflect the implementation. The investigation script formerly kept at `.scratch/poker-eval-reference/eq2.js` was deleted after its implementation and verification moved into the maintained source and tests.
