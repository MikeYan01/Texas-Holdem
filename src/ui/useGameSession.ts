// The bridge between the engine and React.
//
// Everything the engine refuses to own lives here: the clock. Bots pause before
// acting, community cards arrive at a readable pace, and an all-in run-out is
// dealt one Street at a time — all of it by `setTimeout` in this file, driving a
// reducer that has never heard of time.
//
// The pause is not decoration. A Bot decides instantly; without it, pressing fold
// jumps to your next Hand within a frame and you never see what the other five
// did — which in Hold'em is nearly all of the information there is.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { seededRng, type Rng } from '../poker-math/rng.ts';
import { createSession, reduce } from '../engine/engine.ts';
import type { GameEvent, PlayerAction, SessionState } from '../engine/types.ts';
import { PERSONALITIES } from '../bots/personalities.ts';
import { decide } from '../bots/decide.ts';
import { assignPersonalities, makeBotView } from '../bots/view.ts';
import type { EquityProvider, PersonalityKey } from '../bots/types.ts';
import { equityProvider } from './equity.ts';
import { describeEvent, type LogLine } from './text/events.ts';
import { PLAYER_NAME, assignBotNames } from './bot-names.ts';

/** How long each automatic step waits, in milliseconds. */
export const PACING = {
  // Long enough to actually read what a Bot did before the next one moves. The
  // spec asked for 600-1200ms; play-testing said that is too quick to follow
  // five opponents in a row, so it was widened.
  botThinkMin: 900,
  botThinkMax: 1900,
  dealStreet: 800,
  runoutStreet: 1100,
  settle: 950,
  startHand: 400,
} as const;

const MAX_LOG_LINES = 240;
const MAX_ANIMATIONS = 16;

export type ChipAnimation = {
  readonly id: number;
  /** Chips leaving a Seat for the middle, or the middle going to a winner. */
  readonly kind: 'seat-to-pot' | 'pot-to-seat';
  readonly seat: number;
  readonly amount: number;
};

type Game = {
  readonly seed: number;
  readonly session: SessionState;
  readonly log: readonly LogLine[];
  readonly animations: readonly ChipAnimation[];
  readonly seating: ReadonlyMap<number, PersonalityKey>;
  /** Display names, drawn separately from personalities so neither gives the
      other away. */
  readonly names: ReadonlyMap<number, string>;
  readonly counter: number;
};

function newGame(seed: number): Game {
  const session = createSession({ seed });
  return {
    seed,
    session,
    log: [],
    animations: [],
    seating: assignPersonalities(session.config.seatCount, session.playerSeat, seededRng(seed ^ 0x5f3759df)),
    names: assignBotNames(session.config.seatCount, session.playerSeat, seededRng(seed ^ 0x27d4eb2f)),
    counter: 0,
  };
}

function animationsFor(events: readonly GameEvent[], from: number): ChipAnimation[] {
  const made: ChipAnimation[] = [];
  let id = from;
  for (const event of events) {
    if (event.type === 'acted' && event.paid > 0) {
      made.push({ id: id++, kind: 'seat-to-pot', seat: event.seat, amount: event.paid });
    } else if (event.type === 'blind-posted' && event.amount > 0) {
      made.push({ id: id++, kind: 'seat-to-pot', seat: event.seat, amount: event.amount });
    } else if (event.type === 'pot-awarded') {
      for (const winner of event.winners) {
        made.push({ id: id++, kind: 'pot-to-seat', seat: winner.seat, amount: winner.amount });
      }
    }
  }
  return made;
}

/**
 * Take one step. Pure, so React may safely call it twice in development, and so
 * the log can never be appended to twice for the same step.
 */
function step(game: Game, action: PlayerAction | { type: 'advance' }): Game {
  const session = reduce(game.session, action);
  const nameOf = (seat: number) => seatName(seat, session.playerSeat, game.names);

  const lines: LogLine[] = [];
  let counter = game.counter;
  for (const event of session.events) {
    const described = describeEvent(event, nameOf);
    if (described) lines.push({ id: `${counter++}`, ...described });
  }

  const fresh = animationsFor(session.events, counter);
  counter += fresh.length;

  return {
    ...game,
    session,
    counter,
    log: [...game.log, ...lines].slice(-MAX_LOG_LINES),
    // Animations run once and finish invisible, so old ones can simply be
    // dropped off the end rather than needing a timer to clean them up.
    animations: [...game.animations, ...fresh].slice(-MAX_ANIMATIONS),
  };
}

export function seatName(
  seat: number,
  playerSeat: number,
  names: ReadonlyMap<number, string>,
): string {
  if (seat === playerSeat) return PLAYER_NAME;
  return names.get(seat) ?? `${seat + 1} 号位`;
}

export type GameController = {
  readonly session: SessionState;
  readonly log: readonly LogLine[];
  readonly animations: readonly ChipAnimation[];
  readonly seating: ReadonlyMap<number, PersonalityKey>;
  readonly nameOf: (seat: number) => string;
  readonly act: (action: PlayerAction) => void;
  readonly nextHand: () => void;
  readonly restart: () => void;
};

export function useGameSession(options?: {
  seed?: number;
  equity?: EquityProvider;
  /** False while the start screen is up: nothing should be dealt behind it. */
  enabled?: boolean;
}): GameController {
  const equity = options?.equity ?? equityProvider;
  const enabled = options?.enabled ?? true;
  const [game, setGame] = useState<Game>(() => newGame(options?.seed ?? randomSeed()));
  const botRng = useRef<Rng>(seededRng(game.seed));
  const { session } = game;

  const advance = useCallback(() => {
    setGame((current) => (current.session === session ? step(current, { type: 'advance' }) : current));
  }, [session]);

  const act = useCallback(
    (action: PlayerAction) => {
      setGame((current) => (current.session === session ? step(current, action) : current));
    },
    [session],
  );

  // The clock. One timer at a time, cancelled whenever the state moves on.
  useEffect(() => {
    if (!enabled) return;
    if (session.phase === 'session-complete' || session.phase === 'hand-complete') return;

    if (session.phase === 'awaiting-action') {
      if (session.actorSeat === session.playerSeat) return; // no countdown, ever
      const seat = session.actorSeat!;
      const key = game.seating.get(seat) ?? 'TAG';
      const wait =
        PACING.botThinkMin + Math.random() * (PACING.botThinkMax - PACING.botThinkMin);

      let cancelled = false;
      const timer = setTimeout(() => {
        void (async () => {
          let action: PlayerAction;
          try {
            action = await decide(makeBotView(session, seat), PERSONALITIES[key], {
              equity,
              rng: botRng.current,
            });
          } catch (error) {
            // A Bot must never be able to wedge the table. Checking or folding is
            // always legal, so fall back to it and keep the Hand moving.
            console.error('bot decision failed, folding instead', error);
            action = session.legalActions?.canCheck ? { type: 'check' } : { type: 'fold' };
          }
          if (cancelled) return;
          setGame((current) => (current.session === session ? step(current, action) : current));
        })();
      }, wait);

      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    const wait =
      session.phase === 'awaiting-hand'
        ? PACING.startHand
        : session.phase === 'awaiting-showdown'
          ? PACING.settle
          : session.revealedSeats.length > 0
            ? PACING.runoutStreet
            : PACING.dealStreet;

    const timer = setTimeout(advance, wait);
    return () => clearTimeout(timer);
  }, [enabled, session, game.seating, advance, equity]);

  const nameOf = useCallback(
    (seat: number) => seatName(seat, session.playerSeat, game.names),
    [session.playerSeat, game.names],
  );

  const restart = useCallback(() => {
    const seed = randomSeed();
    botRng.current = seededRng(seed);
    setGame(newGame(seed));
  }, []);

  return useMemo(
    () => ({
      session,
      log: game.log,
      animations: game.animations,
      seating: game.seating,
      nameOf,
      act,
      nextHand: advance,
      restart,
    }),
    [session, game.log, game.animations, game.seating, nameOf, act, advance, restart],
  );
}

const randomSeed = (): number => Math.floor(Math.random() * 0x7fffffff);
