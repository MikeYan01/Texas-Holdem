# The 7-card evaluator is written from scratch, not taken from a library

The evaluator is the core of the engine: it decides who wins, who splits the pot, and what the interface says in lines like "two pair, aces and kings". We write our own and take on no runtime dependency; `phe` is a **dev dependency** only, used for differential testing, and it is removed before release.

The decision rests on measurement (Apple M3 Pro / Node v26.7; evidence and reproduction scripts in `.scratch/poker-eval-reference/`): the hand-written version is **73 significant lines, gzip 926 B, 4.1 million/sec**, while `phe` is **68.6 KB gzip** and 2.3× faster — and that 2.3× is of no use to us: one Bot decision needs only about 60,000 evaluations (about 7 ms).

## Considered Options

**`phe@0.6.0`.** The fastest, second smallest, MIT, and measured to run in the browser (still working once bundled with `fs`/`path`/`zlib` stubbed out). A good option, only it pays 74× the size for a 2.3× we cannot use, ships no TS types, and was last published in 2018.

**`poker-evaluator@2.1.1`.** Ruled out: **at module load** it `fs.readFileSync`s the 130 MB Two Plus Two table, and esbuild flatly refuses to bundle it. The prototype ran perfectly well in Node and died the moment it was bundled — the most insidious class of trap there is.

**`pokersolver@2.1.4` (the most downloaded).** Ruled out: measured at 15 µs a call, 2000 Monte Carlo iterations × 6 hands ≈ **180 ms per Bot**, close to 1 second for one Street.

**The Two Plus Two lookup table.** Ruled out, and for a reason that runs against intuition: the table is 32,487,834 entries and 124 MiB, still **19 MB** after brotli; and it measured **7–8× slower** than `phe` — a 124 MB table blows out every level of cache. The algorithm's own author predicted this in his documentation. The "150 M/s" that circulates online comes from a nested-loop benchmark that reuses partial lookups, and a real Equity simulation never meets that access pattern.

## Consequences

"Writing your own is risky" — the objection that usually holds — is cancelled here: exhaustive enumeration of **all C(52,7) = 133,784,560 seven-card hands** takes 37 seconds, and the frequencies of the nine hand categories match the published values exactly; on top of that, 300,000 differential comparisons of ordering against `phe` (0 disagreements). This verification is more thorough than most libraries' own tests, and it has to go into CI.

The evaluator must return **a single comparable integer** (equal means the pot is split). Returning "a category plus a separate array of Kickers" would force every call site to write its own comparison logic, and that is exactly where pot-splitting bugs breed.

The known implementation traps, every one of them verified against `phe`, every one of them requiring a test: a flush that also contains a straight **is not** a straight flush (the straight has to be found inside the flush's own suit); the A-2-3-4-5 wheel needs a special case; the ace does not wrap (Q K A 2 3 is not a straight); two sets of trips make a full house; seven cards can contain three pairs, and the two-pair Kicker may be the rank of the third pair; the quads Kicker may come from a pair; six or seven cards of a suit means taking the best five.

## Note (after the v1 implementation)

The `.scratch/poker-eval-reference/` named above has been deleted. Those four investigation scripts existed so that the numbers in this decision could be reproduced, and now **the repository holds better evidence, and it runs in CI every time**:

- `src/poker-math/evaluate-hand.exhaustive.slow.test.ts` — exhaustively enumerates all 133,784,560 seven-card hands; the frequencies of the nine hand categories match the published values exactly (about 28 seconds).
- `src/poker-math/evaluate-hand.differential.test.ts` — 600,000 differential comparisons of ordering and ties against `phe`, zero disagreements.
- `src/poker-math/evaluate-hand.properties.test.ts` — 60,000 random hands checking `bestFive` and `tiebreakersOf`, the two things neither the exhaustive nor the differential test reaches.
- `src/poker-math/evaluate-hand.perf.test.ts` — a throughput baseline that guards against order-of-magnitude regression and nothing else.

One-off scripts replaced by real tests is the ending this decision deserved.
