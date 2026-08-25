import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { createSession, reduce } from '../engine/engine.ts';
import { isPlayerToAct } from '../engine/selectors.ts';
import type { SessionState } from '../engine/types.ts';
import { seededRng } from '../poker-math/rng.ts';
import { App } from './App.tsx';
import { LocaleProvider } from './locale-context.tsx';
import { assignBotNames } from './bot-names.ts';
import { assignPersonalities } from '../bots/view.ts';
import { seatName, type GameController, type LoggedEvent } from './useGameSession.ts';
import { TableScreen } from './screens/TableScreen.tsx';
import { ResultsScreen } from './screens/ResultsScreen.tsx';
import { RevealPanel } from './components/RevealPanel.tsx';
import { LOCALES, type Locale } from './text/locale.ts';

// Does the language switch actually change what is on screen?
//
// Nothing else in the suite renders a component, and no type can answer this:
// a string left hard-coded in a `.tsx` file compiles perfectly and then sits
// there in Chinese with the interface set to English. So the load-bearing
// assertion here is the negative one — no CJK anywhere in an English render.
//
// This is static markup, not a browser. No effects run, so no Bot ever acts and
// no timer fires; that is fine, because what is being checked is the words.

const CJK = /[\u4e00-\u9fff]/;

const render = (element: ReactElement, locale: Locale): string =>
  renderToStaticMarkup(<LocaleProvider initial={locale}>{element}</LocaleProvider>);

/**
 * A table stopped on the Player's turn, with a log behind it.
 *
 * It has to be the Player's turn or the action bar renders its idle state and
 * the buttons — the densest patch of text on the screen — never get looked at.
 */
function tableController(): GameController {
  let session: SessionState = createSession({ seed: 20_260_825 });
  const log: LoggedEvent[] = [];

  for (let step = 0; step < 500 && !isPlayerToAct(session); step++) {
    session =
      session.phase === 'awaiting-action'
        ? reduce(session, session.legalActions!.canCheck ? { type: 'check' } : { type: 'call' })
        : reduce(session, { type: 'advance' });
    for (const event of session.events) log.push({ id: `${log.length}`, event });
  }

  const names = assignBotNames(session.config.seatCount, session.playerSeat, seededRng(7));
  const seating = assignPersonalities(session.config.seatCount, session.playerSeat, seededRng(7));

  return {
    session,
    log,
    animations: [],
    seating,
    nameOf: (seat) => seatName(seat, session.playerSeat, names, 'en'),
    act: () => {},
    nextHand: () => {},
    restart: () => {},
  };
}

/** A settled Hand, so the Reveal panel has pots and winners to describe. */
function settledSession(): SessionState {
  let session: SessionState = createSession({ seed: 99 });
  for (let step = 0; step < 400 && session.phase !== 'hand-complete'; step++) {
    session =
      session.phase === 'awaiting-action'
        ? reduce(session, session.legalActions!.canCheck ? { type: 'check' } : { type: 'call' })
        : reduce(session, { type: 'advance' });
  }
  return session;
}

/** A finished Session, for the ranking. */
function finishedSession(): SessionState {
  let session: SessionState = createSession({ seed: 5 });
  for (let step = 0; step < 40_000 && session.phase !== 'session-complete'; step++) {
    session =
      session.phase === 'awaiting-action'
        ? reduce(session, session.legalActions!.canCheck ? { type: 'check' } : { type: 'call' })
        : reduce(session, { type: 'advance' });
  }
  return session;
}

describe('the interface in both languages', () => {
  it('opens in the language it was given', () => {
    expect(render(<App />, 'zh')).toContain('开始新局');
    expect(render(<App />, 'en')).toContain('New Session');
    expect(render(<App />, 'en')).toContain('Texas Hold&#x27;em');
  });

  it('offers both languages, each written in itself', () => {
    for (const locale of LOCALES) {
      const markup = render(<App />, locale);
      expect(markup).toContain('中文');
      expect(markup).toContain('English');
    }
  });

  it('leaves no Chinese on the start screen in English', () => {
    const markup = render(<App />, 'en');
    // The switch itself is the one place Chinese belongs: it is the label for
    // the other language.
    expect(markup.replaceAll('中文', '')).not.toMatch(CJK);
  });

  it('leaves no Chinese on the table in English', () => {
    const controller = tableController();
    expect(isPlayerToAct(controller.session), 'the action bar must be live').toBe(true);
    const markup = render(<TableScreen controller={controller} />, 'en');
    expect(markup).not.toMatch(CJK);
    // ...and the table really did render, rather than falling over into nothing.
    expect(markup).toContain('Hand 1 / 18');
    expect(markup).toContain('Orbit 1 / 3');
    expect(markup).toContain('Fold');
    expect(markup).toContain('Action log');
  });

  it('renders the same table in Chinese', () => {
    const markup = render(<TableScreen controller={tableController()} />, 'zh');
    expect(markup).toContain('弃牌');
    expect(markup).toContain('行动记录');
    expect(markup).toContain('第 1 / 18 手');
  });

  it('leaves no Chinese in the Reveal panel in English', () => {
    const session = settledSession();
    expect(session.phase).toBe('hand-complete');
    const panel = <RevealPanel session={session} nameOf={(s) => `Seat${s}`} onNext={() => {}} />;
    const markup = render(panel, 'en');
    expect(markup).not.toMatch(CJK);
    expect(markup).toContain('Reveal');
    expect(markup).toContain('Board');
    expect(markup).toContain('Next Hand');
    // The pot summary is the part that reaches back into the engine's events.
    expect(markup).toContain('Main pot');
    expect(render(panel, 'zh')).toContain('主池');
  });

  it('leaves no Chinese on the results screen in English', () => {
    const session = finishedSession();
    expect(session.phase).toBe('session-complete');
    const screen = (
      <ResultsScreen session={session} nameOf={(s) => `Seat${s}`} onRestart={() => {}} />
    );
    expect(render(screen, 'en')).not.toMatch(CJK);
    expect(render(screen, 'en')).toContain('Session over');
    expect(render(screen, 'en')).toContain('Play again');
    expect(render(screen, 'zh')).toContain('本局结束');
  });

  it('formats a Score the same way on the felt and in the ranking', () => {
    // These used to disagree: the felt grouped thousands and the ranking did not.
    const session = finishedSession();
    for (const locale of LOCALES) {
      const ranking = render(
        <ResultsScreen session={session} nameOf={(s) => `Seat${s}`} onRestart={() => {}} />,
        locale,
      );
      const table = render(<TableScreen controller={tableController()} />, locale);
      for (const markup of [ranking, table]) {
        expect(markup).not.toContain('NaN');
        expect(markup).not.toContain('undefined');
      }
    }
  });
});
