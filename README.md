# Texas

A browser-based Texas Hold'em game. You against five Bots, eighteen Hands, one ranking.

No backend, no accounts, no real money — open the page and play.
The interface is in English by default, with Chinese a click away in the corner.

**[Play it here.](https://mikeyan01.github.io/Texas-Holdem/)**

## The game

Six-handed no-limit Hold'em. Blinds are fixed at 2/5, everyone starts with 100 chips,
and a Session is three Orbits — eighteen Hands — after which the table is ranked on
net win/loss.

- **Five Bots, five styles** — tight-aggressive, loose-aggressive, calling station,
  rock, and a bluffer. They are named after real players, and the names are reshuffled
  every Session, so working out who is tight and who is bluffing has to be done from
  what you see this Session. You cannot memorise it and carry it into the next one.
- **Every Hand ends with a Reveal** — all six sets of hole cards turn face up, including
  everyone who folded on the first round. This is the part worth playing for: you finally
  find out whether that raise was a bluff.
- **Hand odds** — when it is your turn, you are shown the probability of finishing with
  each hand category. The numbers are computed exactly, not estimated.
- **Bust and you are bought back in automatically.** Nobody is knocked out, so all six
  Seats stay occupied for all eighteen Hands.

Not in scope: real money, online play, tournaments, solver-grade AI, difficulty
settings, mobile layouts.

## Running it

Requires Node `^20.19` or `>=22.12`.

```sh
npm install
npm run dev        # dev server
```

```sh
npm run build      # production build, output in dist/
npm run preview    # preview the production build locally
```

The build is a set of static files. Drop it on any static host and it runs.

Every push to `main` is typechecked, tested and published to GitHub Pages by
`.github/workflows/deploy.yml`. Because Pages serves this as a project site under
`/Texas-Holdem/` rather than at a domain root, the production build sets its base
path to match; the dev server keeps `/`.

## Developing

```sh
npm run check:all   # types + engine boundary + every test. Run this before committing
npm run test:fast   # what to run while working — takes seconds
npm run test:watch  # watch mode
npm test            # everything, including the exhaustive verification, ~30s
```

| Path | What it is |
| --- | --- |
| `src/engine/` | The rules engine. A pure state machine |
| `src/poker-math/` | Hand evaluation, equity, hand odds |
| `src/bots/` | Bot decision-making |
| `src/ui/` | The React interface |
| `scripts/` | Offline scripts: table generation, Bot balance measurement, boundary check |

The two preflop lookup tables are **generated**, not transcribed from anywhere.
Regenerate them after changing the evaluator:

```sh
npm run gen:tables    # both tables, ~3 minutes total (needs Node >= 23.6)
npm run measure:bots  # Bot balance, mandatory after touching personality constants
```

Three conventions worth knowing before you change anything:

1. **The engine side (`engine` / `poker-math` / `bots`) is dependency-free and pure.**
   It does not touch the DOM, the network or a timer, and it neither generates its own
   randomness nor reads a clock — both are injected, which is why any Session replays
   exactly from a seed. `npm run check:boundary` enforces this.
2. **No user-facing text on the engine side.** The interface is bilingual; every word a
   player reads lives under `src/ui/text/`. The engine emits structured events and error
   codes and nothing else.
3. **Terminology follows [`CONTEXT.md`](CONTEXT.md).** Seat, Stack, Score, Street, Orbit
   and the rest have precise, non-overlapping meanings here. Don't swap in synonyms.

For **why** any of it is built this way, read [`docs/adr/`](docs/adr/): why the hand
evaluator is written from scratch, why equity is computed three different ways depending
on the Street, why Bot balance is measured rather than eyeballed, why the interface is
bilingual. Each one records the options that were rejected and what the decision cost.

Conventions for AI agents working in the repo are in [`AGENTS.md`](AGENTS.md).

## Licence

[MIT](LICENSE). The two runtime dependencies, React and React DOM, are MIT as well;
`phe` is MIT and is a dev dependency only, used to differential-test the hand evaluator
and never shipped.
