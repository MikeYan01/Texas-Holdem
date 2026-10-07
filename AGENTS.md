# Texas

A standalone browser game of No-Limit Hold'em: one Player against five Bots, with no backend, accounts or real money.

## Engineering conventions

- Write identifiers, types and comments in English, using the glossary below.
- Keep explanatory comments concise, with one complete sentence per line and an uppercase sentence start; preserve code examples and annotations.
- Keep `src/engine/`, `src/poker-math/` and `src/bots/` dependency-free and free of IO: inject randomness, and leave timers, browser state and rendering to `src/ui/` (ADR-0001).
- Keep game rules and legal action amounts in the engine; the interface consumes them rather than duplicating their arithmetic.
- Emit structured events and error codes from the engine, not user-facing copy.

## Language and display

- Support English and Chinese, switchable during a Session and remembered in `localStorage`.
  The saved choice wins; otherwise Chinese browsers get Chinese and all others get English (ADR-0008).
- Put user-facing copy in `src/ui/text/`: chrome in `ui-strings.ts`, hand names in `hand-description.ts`, commentary in `events.ts`, and Street/pot labels in `labels.ts`.
  Add copy in both languages; `UI_STRINGS` is a `Record<Locale, UiStrings>`.
- Read locale through `useLocale()` in React; pass `Locale` explicitly to pure text functions.
  Store log events, not rendered sentences, so switching language updates existing commentary.
- Show chip counts, never BB; BB is reserved for Bot measurements.
- Keep `all-in` in English in both languages.
- Use untranslated player surnames for Bots, assigned independently of personality and reshuffled every Session.
  Personality labels stay in code, so names never reveal a Bot's style.

## Domain glossary

Use these terms consistently in code, tests, documents and their Chinese translations.
Keep Street, Hand, Orbit and Session distinct rather than calling any of them a "round" or "轮".
Keep Stack and Score distinct rather than calling either "balance", "points" or an unqualified "筹码".

| Term | Meaning |
| --- | --- |
| **No-Limit Hold'em (NLHE)** | The only variant; a Seat may commit its entire Stack. Use the full name when specifying rules, not generic "poker" or "德扑". |
| **Seat (座位)** | A fixed place holding chips and taking actions, not a Position or slot. |
| **Player (玩家)** | The one human-controlled Seat; address it as You/你 in the interface, not Hero. |
| **Bot** | A Seat controlled by fixed heuristics, not learning or training; use Bot rather than AI, CPU or 机器人. |
| **Button (庄家位)** | The nominal dealer marker, moving clockwise each Hand and determining blinds and action order; not a separate dealer role. |
| **Position (位置)** | Acting order relative to the Button and live Seats, not a seat index. Bots measure postflop order from first to last, even before the flop. |
| **Blind (盲注)** | Forced small/big bets to the Button's left, fixed at 2/5; not an ante. |
| **Street (下注圈)** | One betting stage: preflop, flop, turn or river. A Hand can end before reaching all four. |
| **Hand (一手牌)** | One deal through settlement, ending at Showdown or when everyone but one Seat folds; not a Session or 局. |
| **Orbit (一圈)** | One complete Button rotation: six Hands, with every Seat posting each Blind once. |
| **Session (一局)** | Three Orbits, eighteen Hands, ending in a ranking on Score; not a tournament or elimination game. |
| **Showdown (摊牌)** | Live Seats compare cards after the river; this does not happen when everyone but one has folded. |
| **Reveal (复盘亮牌)** | The learning display after every settled Hand, showing every Seat's hole cards, including folded Seats; not Showdown. |
| **Stack (码量)** | The bounded chips available to a Seat for the current Hand, initially 100; it determines the all-in ceiling. |
| **Side Pot (边池)** | Money above a short all-in Seat's contribution, contested only by eligible Seats; not a split pot, which is a tie. |
| **Effective Stack (有效码量)** | The smaller of a Seat's Stack and the largest live opponent's Stack; folded Seats do not count. |
| **Aggressor (主动下注者)** | The last Seat to bet or raise on a Street, including an all-in that raises the bet; a short all-in call does not qualify. Keep only current/previous Street leadership, not a full engine action history. |
| **Score (净胜负)** | Signed Session net win/loss and the sole ranking criterion, computed as Stack minus total bought in. Scores sum to zero after settlement; during betting, Scores plus committed chips sum to zero. |
| **Rebuy (补码)** | Restore a zero Stack to the starting amount between Hands. Stack and total bought in rise equally, leaving Score unchanged; Rebuys are uncapped and nobody is eliminated. |
| **Equity (胜率)** | The Bot's estimate of winning strength against opponents, counting ties as half a win. It is not displayed; distinguish it from Hand Odds and Pot Odds. |
| **Pot Odds (底池赔率)** | The call divided by pot plus call, used as the break-even threshold for calling; say Pot Odds in full. |
| **Opening Range (开局范围)** | A Bot's preflop raising threshold, ranked on heads-up Equity and weighted over all 1326 holdings. It narrows with price and widens in later Position; it ranks the Bot's own cards, not an opponent's range. |
| **Kicker (踢脚)** | A spare rank deciding between otherwise equal hands; not a side card, 副牌 or 单张. |
| **Hand Odds (成牌概率)** | The exact, opponent-independent distribution of final hand categories. The interface shows the five likeliest nonzero categories. |
| **Upside (成大牌概率)** | The probability of making a straight or better, using a fixed category threshold, not a board-relative one. Bots use it before the river; its river value is 0 or 1 and is ignored. It is not displayed or called draw equity/听牌率. |

## Bot personalities

All five personalities use one decision rule and differ only in constants, never branches on personality identity.
Loose/tight describes entry frequency; passive/aggressive describes calling versus raising.

| Personality | Style |
| --- | --- |
| **TAG** | Tight and aggressive. |
| **LAG** | Loose and aggressive. |
| **Calling Station (跟注站)** | Loose and passive, but still capable of a large bet. |
| **Rock (岩石)** | Tight and passive; bluffs rarely, not never. |
| **Bluffer (诈唬手)** | Frequent aggression without indiscriminately calling losing Hands; not the retired Maniac. |

Keep the strategy heuristic: no solver, opponent range modelling or difficulty settings.
After changing personality constants, run `npm run measure:bots` and the balance regression guard (ADR-0006).

## Decision references

Read the relevant [ADRs](docs/adr/) before changing engine purity (0001), scoring (0002), Bot strategy/balance (0003, 0006, 0009), evaluation/probabilities (0004, 0005, 0007), or localization (0008).
Keep historical measurements and rejected alternatives there rather than duplicating them in source comments or this guide.
