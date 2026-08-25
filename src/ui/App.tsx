import { useEffect, useState } from 'react';
import { LanguageSwitch } from './components/LanguageSwitch.tsx';
import { ResultsScreen } from './screens/ResultsScreen.tsx';
import { StartScreen } from './screens/StartScreen.tsx';
import { TableScreen } from './screens/TableScreen.tsx';
import { useGameSession } from './useGameSession.ts';

/**
 * Three screens and nothing else. A refresh starts a new Session rather than
 * restoring the old one (issue 13): there is no serialisation, and a half-restored
 * table would be worse than a clean one. The `beforeunload` guard is there so a
 * refresh is never an accident.
 *
 * The language switch sits outside the three screens so it is reachable from all
 * of them, mid-Hand included. Switching costs nothing: the log is stored as
 * events and re-read into the new language (ADR-0008).
 */
export function App() {
  const [started, setStarted] = useState(false);
  const controller = useGameSession({ enabled: started });
  const finished = controller.session.phase === 'session-complete';

  useEffect(() => {
    if (!started || finished) return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [started, finished]);

  const screen = !started ? (
    <StartScreen
      onStart={() => {
        controller.restart();
        setStarted(true);
      }}
    />
  ) : finished ? (
    <ResultsScreen
      session={controller.session}
      nameOf={controller.nameOf}
      onRestart={controller.restart}
    />
  ) : (
    <TableScreen controller={controller} />
  );

  return (
    <>
      {screen}
      <LanguageSwitch />
    </>
  );
}
