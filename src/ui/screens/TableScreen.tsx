import { useMemo, useState } from 'react';
import { handOdds, likeliestCategories, madeCategoryNow } from '../../poker-math/hand-odds.ts';
import { isPlayerToAct } from '../../engine/selectors.ts';
import { ActionBar } from '../components/ActionBar.tsx';
import { ActionLog } from '../components/ActionLog.tsx';
import { HandOddsReadout } from '../components/HandOddsReadout.tsx';
import { PokerTable } from '../components/PokerTable.tsx';
import { RevealPanel } from '../components/RevealPanel.tsx';
import type { GameController } from '../useGameSession.ts';
import { STREET_NAMES } from '../text/labels.ts';

/** How many hand categories to list. Nine is too many to read at a glance. */
const CATEGORIES_SHOWN = 5;

export function TableScreen({ controller }: { controller: GameController }) {
  const { session, log, equity, nameOf, act, nextHand } = controller;
  const [logCollapsed, setLogCollapsed] = useState(false);
  const playersTurn = isPlayerToAct(session);
  const totalOrbits = session.config.handsPerSession / session.config.seatCount;

  const hole = session.seats[session.playerSeat]?.holeCards ?? null;
  const showOdds = hole !== null && session.phase !== 'hand-complete';

  // Cheap enough to do in a render: the worst case is the flop's 1,081 run-outs.
  const odds = useMemo(
    () => (showOdds && hole ? handOdds(hole, session.board) : null),
    [showOdds, hole, session.board],
  );
  const top = useMemo(() => (odds ? likeliestCategories(odds, CATEGORIES_SHOWN) : []), [odds]);
  const madeNow = useMemo(
    () => (showOdds && hole ? madeCategoryNow(hole, session.board) : null),
    [showOdds, hole, session.board],
  );

  return (
    <main className="screen screen--table">
      <header className="topbar">
        <span className="topbar__counter">
          第 <strong>{Math.max(1, session.handNumber)}</strong> / {session.config.handsPerSession} 手
        </span>
        <span className="topbar__counter">
          第 <strong>{Math.max(1, session.orbit)}</strong> / {totalOrbits} 圈
        </span>
        <span className="topbar__street">{STREET_NAMES[session.street]}</span>
        <span className="topbar__blinds">盲注 1 / 2(起始码量 100 BB)</span>
      </header>

      <div className={`layout ${logCollapsed ? 'layout--log-collapsed' : ''}`}>
        <PokerTable controller={controller} />
        <ActionLog
          lines={log}
          collapsed={logCollapsed}
          onToggle={() => setLogCollapsed((collapsed) => !collapsed)}
        />
      </div>

      <footer className="controls">
        <HandOddsReadout odds={odds} top={top} madeNow={madeNow} equity={equity} />
        <ActionBar
          legal={playersTurn ? session.legalActions : null}
          waiting={session.phase !== 'hand-complete'}
          onAct={act}
        />
      </footer>

      {session.phase === 'hand-complete' && (
        <div className="overlay">
          <RevealPanel session={session} nameOf={nameOf} onNext={nextHand} />
        </div>
      )}
    </main>
  );
}
