import { useEffect, useState } from 'react';
import { ResultsScreen } from './screens/ResultsScreen.tsx';
import { StartScreen } from './screens/StartScreen.tsx';
import { TableScreen } from './screens/TableScreen.tsx';
import { useGameSession } from './useGameSession.ts';

/**
 * Three screens and nothing else. A refresh starts a new Session rather than
 * restoring the old one (issue 13): there is no serialisation, and a half-restored
 * table would be worse than a clean one. The `beforeunload` guard is there so a
 * refresh is never an accident.
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

  if (!started) {
    return (
      <StartScreen
        onStart={() => {
          controller.restart();
          setStarted(true);
        }}
      />
    );
  }

  if (finished) {
    return (
      <ResultsScreen
        session={controller.session}
        nameOf={controller.nameOf}
        onRestart={controller.restart}
      />
    );
  }

  return <TableScreen controller={controller} />;
}
