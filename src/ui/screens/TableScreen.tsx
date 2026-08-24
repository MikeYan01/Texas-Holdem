import { useState } from 'react';
import { isPlayerToAct } from '../../engine/selectors.ts';
import { ActionBar } from '../components/ActionBar.tsx';
import { ActionLog } from '../components/ActionLog.tsx';
import { EquityReadout } from '../components/EquityReadout.tsx';
import { PokerTable } from '../components/PokerTable.tsx';
import { RevealPanel } from '../components/RevealPanel.tsx';
import type { GameController } from '../useGameSession.ts';
import { STREET_NAMES } from '../text/labels.ts';

export function TableScreen({ controller }: { controller: GameController }) {
  const { session, log, equity, nameOf, act, nextHand } = controller;
  const [logCollapsed, setLogCollapsed] = useState(false);
  const playersTurn = isPlayerToAct(session);
  const totalOrbits = session.config.handsPerSession / session.config.seatCount;

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
        <EquityReadout readout={equity} />
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
