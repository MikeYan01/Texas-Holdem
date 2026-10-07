import { useMemo, useState, type CSSProperties } from 'react';
import { handOdds, likeliestCategories, madeCategoryNow } from '../../poker-math/hand-odds.ts';
import { isPlayerToAct } from '../../engine/selectors.ts';
import { ActionBar } from '../components/ActionBar.tsx';
import { ActionLog } from '../components/ActionLog.tsx';
import { AnimatedOverlay } from '../components/AnimatedOverlay.tsx';
import { HandRankingsPanel } from '../components/HandRankingsPanel.tsx';
import { HandOddsReadout } from '../components/HandOddsReadout.tsx';
import { PokerTable } from '../components/PokerTable.tsx';
import { RevealPanel } from '../components/RevealPanel.tsx';
import type { GameController } from '../useGameSession.ts';

import { useLocale } from '../locale-context.tsx';

/**
 * How many hand categories to list.
 * Nine is too many to read at a glance.
 */
const CATEGORIES_SHOWN = 5;
const COMPACT_TABLE_MEDIA = '(max-width: 900px), (max-height: 600px)';

function compactLogByDefault(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(COMPACT_TABLE_MEDIA).matches
  );
}

export function TableScreen({ controller }: { controller: GameController }) {
  const { t } = useLocale();
  const { session, log, nameOf, act, nextHand } = controller;
  const [logCollapsed, setLogCollapsed] = useState(compactLogByDefault);
  const [rankingsOpen, setRankingsOpen] = useState(false);
  const [revealClosing, setRevealClosing] = useState(false);
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
    <main
      className="screen screen--table"
      style={{ '--reveal-log-width': logCollapsed ? '40px' : 'var(--log-width)' } as CSSProperties}
    >
      <header className="topbar">
        <span className="topbar__brand" aria-hidden="true">♠</span>
        <span className="topbar__counter" title={t.table.handCounterNote}>
          {t.table.handCounter(Math.max(1, session.handNumber), session.config.handsPerSession)}
        </span>
        <span
          className="topbar__counter"
          title={t.table.orbitCounterNote(session.config.seatCount)}
        >
          {t.table.orbitCounter(Math.max(1, session.orbit), totalOrbits)}
        </span>
        <button
          type="button"
          className="topbar__help"
          title={t.rankings.openNote}
          onClick={() => setRankingsOpen(true)}
        >
          {t.rankings.open}
        </button>
        <span className="topbar__blinds">
          {t.table.blinds(
            session.config.smallBlind,
            session.config.bigBlind,
            session.config.startingStack,
          )}
        </span>
        <div className="topbar__progress" aria-hidden="true">
          <span style={{ width: `${(session.handNumber / session.config.handsPerSession) * 100}%` }} />
        </div>
      </header>

      <div className={`layout ${logCollapsed ? 'layout--log-collapsed' : ''}`}>
        <PokerTable controller={controller} />
        <ActionLog
          entries={log}
          nameOf={nameOf}
          playerSeat={session.playerSeat}
          collapsed={logCollapsed}
          onToggle={() => setLogCollapsed((collapsed) => !collapsed)}
        />
      </div>

      <footer className={`controls${playersTurn ? ' controls--active' : ''}`}>
        <HandOddsReadout odds={odds} top={top} madeNow={madeNow} />
        <ActionBar
          legal={playersTurn ? session.legalActions : null}
          waiting={session.phase !== 'hand-complete'}
          onAct={act}
        />
      </footer>

      {session.phase === 'hand-complete' && (
        <AnimatedOverlay
          open={!revealClosing}
          onExited={() => {
            setRevealClosing(false);
            nextHand();
          }}
        >
          <RevealPanel session={session} nameOf={nameOf} onNext={() => setRevealClosing(true)} />
        </AnimatedOverlay>
      )}

      <AnimatedOverlay open={rankingsOpen} modal>
        <HandRankingsPanel onClose={() => setRankingsOpen(false)} />
      </AnimatedOverlay>
    </main>
  );
}
