# Texas

A web-based Texas Hold'em poker game.

## Conventions

### Language

Identifiers, type names and comments are all in English, and they use the terms fixed in
`CONTEXT.md` (`Seat`, `Stack`, `Score`, `Street`, `Orbit`…).

The user-facing interface is **bilingual**: English and Chinese, switchable at runtime, with
the choice kept in `localStorage`. **English is the default**; a browser reporting a Chinese
language gets Chinese (ADR-0008). That has a consequence which is harder than it used to be:
**no user-visible text is allowed inside the engine modules.** The engine emits structured
events and error codes, and the render layer turns them into words. A Chinese string smuggled
into the engine used to be merely untidy; now it is a hole in the English interface. This is
the same constraint as ADR-0001 (the engine touches no IO) seen from the other side, and
`npm run check:boundary` guards it.

All copy lives under `src/ui/text/`: interface chrome in `ui-strings.ts`, hand names in
`hand-description.ts`, the action log in `events.ts`, Street and pot names in `labels.ts`.
**No literal copy in components or screens** — components read it from `useLocale()`, and the
pure modules take a `Locale` as an explicit argument, which is what keeps them testable
without React.

Adding copy means adding it in both languages. `UI_STRINGS` is a `Record<Locale, UiStrings>`,
so a missing key is a compile error; a missing value, a dropped interpolation argument, or
Chinese leaking into the English bundle is caught by `src/ui/text/ui-strings.test.ts`. And
`src/ui/i18n.smoke.test.tsx` actually renders the three screens and asserts there is not one
Chinese character in the English render.

`all-in` stays in English in both languages, because the Chinese rendering is not what anyone
at a table actually says.

**The interface always shows chip counts, never BB.** BB is the right unit for measuring Bot
strength — it does not distort when the stakes move — but to a Player it is just a second name
for a quantity already on screen, and "20 BB" beside a Seat holding 100 reads as a
contradiction rather than as extra information.

On screen the Bots use the surnames of real players (Brunson, Ivey…), untranslated in both
languages. The personality names (TAG / LAG / Rock…) exist only in the code — see
`CONTEXT.md`.

## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, used verbatim (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
