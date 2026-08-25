# The interface is bilingual, and locale is an explicit parameter, not an environment

The interface speaks English and Chinese at once, switchable at any moment from the top right, and the choice is kept in `localStorage`. **English is the default**; with no stored choice, a browser whose `navigator.language` is Chinese goes straight to Chinese and everything else goes to English.

The default is English rather than Chinese because, once this is open source, more of the people who find this repository read English; Chinese is one click away, and `localStorage` remembers it so the question is never asked twice. The `lang` and `<title>` in `index.html` are hard-coded to English too, so the first paint agrees with the default and no Chinese title flashes past.

**Locale is passed in two different ways, and that is the substance of this decision**:

- The modules that turn engine values into words — `events.ts`, `hand-description.ts`, `labels.ts` — take `Locale` as **an ordinary parameter** and know nothing about React.
- Components and screens get it from `useLocale()`, because threading one prop through eight layers of JSX buys nothing.

The dividing line is not "which is more convenient" but **which side has tests**. `full-session.test.ts` plays a whole Session in Node and asserts that every event the engine emits renders as a line of text; `hand-description.test.ts` sweeps every hand category. Those assertions now run once per **language** — and not one of them could be written if locale were hidden inside a React context.

## Considered Options

**Bring in an i18n library (i18next / react-intl).** Rejected, and not over bundle size. What they are built on is looking strings up by key, which demotes "a translation is missing" from a **compile error** to a blank or a fallback at runtime. This project uses `UI_STRINGS: Record<Locale, UiStrings>`: one key short and `tsc` fails on the spot. Taking on ICU message format and a runtime, for two languages and one file's worth of copy, buys a weaker guarantee.

**Route all copy through React context.** Rejected, for the reason above: it would turn `describeEvent` and `describeHand` into things callable only inside a render tree, and they happen to be the only part of the rendering layer that is seriously tested. This is the same move as ADR-0001 making the RNG a number on the state rather than a closure — turning the environment into an explicit value is what makes it testable.

**Keep storing rendered strings in the action log.** Rejected. That was the original implementation: `useGameSession` ran every event through `describeEvent` and pushed the line into `log`. Switch language once and the previous few dozen lines sit there in the old one while the next line arrives underneath in the new one. `log` now holds the `GameEvent` itself, and `ActionLog` turns it into words at render time — **switching language is retroactive; the whole Session is re-read**. The price is one `flatMap` over a few dozen events per Hand, an order of magnitude that could not matter less.

**Choose the language on the start screen only.** Rejected. That writes an implementation detail — "switching is expensive" — into the product. Since the log already stores events, switching in the middle of a Session is free.

**Call the Player "Hero" in English.** Rejected, even though that is the PokerStars hand-history format and it would sidestep subject-verb agreement in one stroke. CONTEXT.md spells out `_Avoid_: user, human, hero` under the Player entry, and the reason holds: Hero is jargon, and this game is played by beginners.

## Consequences

**English has to handle subject-verb agreement.** "You fold" but "Ivey folds". Chinese draws no distinction — 「你 弃牌」and「Ivey 弃牌」take the same verb. English does, and the Player can only be called You (see above), so `describeEvent` carries an extra `playerSeat` parameter and the English phrase table has a `verb(you, base)`. This is the one place where this decision lets a grammatical difference seep into an interface, and `events.test.ts` has a test watching specifically for the "You folds" mistake.

**Chip numbers are digit-grouped by language.** This swept up a drift that had already happened: the same Score displayed as `+1,240` at the table and `+1240` on the settlement screen — the formatting was written out in both places and only one of them grouped thousands. There is now one definition, `formatChips` / `formatScore`. Likewise, "how many times a Seat has rebought" used to be an unrounded division inside JSX and is now `rebuyCount` in `selectors.ts` — it is a rule, and rules live on the engine side.

**The repository has its first test of a rendered component.** `src/ui/i18n.smoke.test.tsx` uses `react-dom/server` to render three screens to static HTML and asserts that the English render contains **not one Chinese character**. This is the real guard in this change: a Chinese sentence left behind in a `.tsx` file passes type-checking perfectly and then shows itself to an English-speaking user just like that. It is verified to have teeth — put ActionBar's 「弃牌」 back as a literal and it fails immediately. No jsdom, no testing-library; `react-dom` was already there.

**The cost of a third language is explicit:** add an entry to `LOCALES` → `tsc` names every bundle that is missing; add one to `ui-strings.ts`; add branches in `labels.ts` and `hand-description.ts`; add a phrase table to `events.ts`. The tests point out the gaps one at a time, including "this one is word for word identical to the other language, so it was probably never translated".

**`localStorage` appears only in `locale-context.tsx`, and it is wrapped in `try`/`catch`** — a browser with storage disabled makes it throw rather than return null, and a language preference is not worth taking the page down for. What ADR-0001 forbids is the **engine** touching IO; choosing a language is exactly what the rendering layer is there for.
