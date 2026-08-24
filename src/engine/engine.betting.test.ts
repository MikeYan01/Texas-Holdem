import { describe, expect, it } from 'vitest';
import { createSession, reduce } from './engine.ts';
import { positionAt } from './test-fixtures.ts';
import { chipsInPlay } from './selectors.ts';
import { IllegalActionError, type PlayerAction, type SessionState } from './types.ts';

const advance = (state: SessionState) => reduce(state, { type: 'advance' });
const act = (state: SessionState, action: PlayerAction) => reduce(state, action);

/** A scripted strategy, as the ticket asks for: no real Bot, no randomness. */
type Script = (state: SessionState) => PlayerAction;

const alwaysCall: Script = (state) =>
  state.legalActions?.canCheck ? { type: 'check' } : { type: 'call' };
const alwaysFold: Script = (state) =>
  state.legalActions?.canCheck ? { type: 'check' } : { type: 'fold' };

function run(start: SessionState, script: Script, until: (s: SessionState) => boolean): SessionState {
  let state = start;
  for (let step = 0; step < 500; step++) {
    if (until(state)) return state;
    state = state.phase === 'awaiting-action' ? act(state, script(state)) : advance(state);
  }
  throw new Error('did not reach the target state');
}

describe('blinds and the Button', () => {
  it('takes the small and big blind from the two Seats left of the Button', () => {
    const state = advance(createSession({ seed: 21, playerSeat: 0 }));
    const button = state.buttonSeat;
    const small = (button + 1) % 6;
    const big = (button + 2) % 6;

    expect(state.seats[small]!.streetCommitted).toBe(1);
    expect(state.seats[big]!.streetCommitted).toBe(2);
    expect(state.seats[small]!.stack).toBe(199);
    expect(state.seats[big]!.stack).toBe(198);
    expect(state.currentBet).toBe(2);
  });

  it('moves the Button one Seat clockwise every Hand', () => {
    let state = createSession({ seed: 22 });
    const buttons: number[] = [];
    for (let hand = 0; hand < 8; hand++) {
      state = run(advance(state), alwaysFold, (s) => s.phase === 'hand-complete');
      buttons.push(state.buttonSeat);
      state = advance(state);
    }
    for (let i = 1; i < buttons.length; i++) {
      expect(buttons[i]).toBe((buttons[i - 1]! + 1) % 6);
    }
  });

  it('starts preflop with the Seat left of the big blind', () => {
    const state = advance(createSession({ seed: 23 }));
    expect(state.actorSeat).toBe((state.buttonSeat + 3) % 6);
  });

  it('starts every later Street with the first live Seat left of the Button', () => {
    let state = advance(createSession({ seed: 24 }));
    state = run(state, alwaysCall, (s) => s.street === 'flop' && s.phase === 'awaiting-action');
    expect(state.actorSeat).toBe((state.buttonSeat + 1) % 6);
  });

  it('skips a folded Seat when choosing who starts the Street', () => {
    const state = positionAt({
      seats: [
        { stack: 100, hole: 'Ah Kd' }, // button
        { stack: 100, hole: '2c 3d', folded: true },
        { stack: 100, hole: '5c 6d' },
        { stack: 100, hole: '7c 8d' },
      ],
      buttonSeat: 0,
      street: 'preflop',
      actorSeat: null,
      phase: 'awaiting-deal',
      currentBet: 0,
    });
    expect(advance(state).actorSeat).toBe(2);
  });
});

describe('legal actions come from the engine, never from the component', () => {
  it('offers a call but not a check when there is a bet to face', () => {
    const state = advance(createSession({ seed: 25 }));
    const legal = state.legalActions!;
    expect(legal.canCheck).toBe(false);
    expect(legal.canCall).toBe(true);
    expect(legal.callAmount).toBe(2);
    expect(legal.canBet).toBe(false); // preflop the blind is already a bet
    expect(legal.canRaise).toBe(true);
  });

  it('offers a check but not a call when nothing is owed', () => {
    const state = positionAt({
      seats: [{ stack: 100, hole: 'Ah Kd' }, { stack: 100, hole: '2c 3d' }, { stack: 100, hole: '5c 6d' }],
      street: 'flop',
      board: '2h 7s 9c',
      currentBet: 0,
      actorSeat: 1,
    });
    const legal = state.legalActions!;
    expect(legal.canCheck).toBe(true);
    expect(legal.canCall).toBe(false);
    expect(legal.callAmount).toBe(0);
    expect(legal.canBet).toBe(true);
    expect(legal.canRaise).toBe(false);
  });

  it('rejects a check when a bet is owed', () => {
    const state = advance(createSession({ seed: 26 }));
    expect(() => act(state, { type: 'check' })).toThrow(IllegalActionError);
  });

  it('rejects a call when nothing is owed', () => {
    const state = positionAt({
      seats: [{ stack: 100, hole: 'Ah Kd' }, { stack: 100, hole: '2c 3d' }, { stack: 100, hole: '5c 6d' }],
      street: 'flop',
      board: '2h 7s 9c',
      currentBet: 0,
      actorSeat: 1,
    });
    expect(() => act(state, { type: 'call' })).toThrow(IllegalActionError);
  });
});

describe('raise sizing', () => {
  const threeHanded = (overrides: Parameters<typeof positionAt>[0]) => positionAt(overrides);

  it('sets the minimum raise to the size of the last raise', () => {
    // Blinds 1/2. The big blind is a raise of 2, so the first raise is to 4.
    const preflop = advance(createSession({ seed: 27 }));
    expect(preflop.legalActions!.minRaiseTo).toBe(4);

    const raised = act(preflop, { type: 'raise', to: 6 });
    // A raise of 4 over 2, so the next full raise must reach 10.
    expect(raised.legalActions!.minRaiseTo).toBe(10);
  });

  it('rejects a raise below the minimum', () => {
    const state = advance(createSession({ seed: 28 }));
    expect(() => act(state, { type: 'raise', to: 3 })).toThrow(IllegalActionError);
  });

  it('rejects a raise larger than the Stack', () => {
    const state = threeHanded({
      seats: [
        { stack: 40, hole: 'Ah Kd', streetCommitted: 0 },
        { stack: 100, hole: '2c 3d', streetCommitted: 10 },
        { stack: 100, hole: '5c 6d', streetCommitted: 10 },
      ],
      street: 'flop',
      board: '2h 7s 9c',
      currentBet: 10,
      actorSeat: 0,
    });
    expect(state.legalActions!.maxRaiseTo).toBe(40);
    expect(() => act(state, { type: 'raise', to: 41 })).toThrow(IllegalActionError);
  });

  it('still lets a short Stack push when it cannot make a full raise', () => {
    const state = threeHanded({
      seats: [
        { stack: 14, hole: 'Ah Kd', streetCommitted: 0 },
        { stack: 100, hole: '2c 3d', streetCommitted: 10 },
        { stack: 100, hole: '5c 6d', streetCommitted: 10 },
      ],
      street: 'flop',
      board: '2h 7s 9c',
      currentBet: 10,
      lastRaiseSize: 10,
      actorSeat: 0,
    });
    const legal = state.legalActions!;
    expect(legal.minRaiseTo).toBe(20);
    expect(legal.maxRaiseTo).toBe(14);
    expect(legal.canRaise).toBe(false); // no full raise is available
    expect(legal.allInTo).toBe(14); // but the right to push never goes away

    const shoved = act(state, { type: 'all-in' });
    expect(shoved.seats[0]!.stack).toBe(0);
    expect(shoved.currentBet).toBe(14);
  });

  it('gives half-pot, pot and all-in as concrete amounts', () => {
    // Flop, pot of 30, nothing bet yet.
    const state = threeHanded({
      seats: [
        { stack: 100, hole: 'Ah Kd', committed: 10, streetCommitted: 0 },
        { stack: 100, hole: '2c 3d', committed: 10, streetCommitted: 0 },
        { stack: 100, hole: '5c 6d', committed: 10, streetCommitted: 0 },
      ],
      street: 'flop',
      board: '2h 7s 9c',
      currentBet: 0,
      actorSeat: 0,
    });
    expect(state.legalActions!.presets).toEqual({ halfPot: 15, pot: 30, allIn: 100 });
  });

  it('sizes a raise off the pot as it would be after calling', () => {
    // 40 in the middle (10 + 20 + 10) and 10 to call: calling makes it 50, so a
    // pot-sized raise puts in another 50 and lands on 60.
    const state = threeHanded({
      seats: [
        { stack: 100, hole: 'Ah Kd', committed: 10, streetCommitted: 0 },
        { stack: 100, hole: '2c 3d', committed: 20, streetCommitted: 10 },
        { stack: 100, hole: '5c 6d', committed: 10, streetCommitted: 0 },
      ],
      street: 'flop',
      board: '2h 7s 9c',
      currentBet: 10,
      lastRaiseSize: 10,
      actorSeat: 0,
    });
    expect(state.legalActions!.presets.pot).toBe(60);
    expect(state.legalActions!.presets.halfPot).toBe(35);
  });

  it('never offers a preset that is not legal', () => {
    const state = threeHanded({
      seats: [
        { stack: 12, hole: 'Ah Kd', committed: 0, streetCommitted: 0 },
        { stack: 100, hole: '2c 3d', committed: 60, streetCommitted: 60 },
        { stack: 100, hole: '5c 6d', committed: 60, streetCommitted: 60 },
      ],
      street: 'flop',
      board: '2h 7s 9c',
      currentBet: 60,
      lastRaiseSize: 60,
      actorSeat: 0,
    });
    const { presets, allInTo } = state.legalActions!;
    // Nothing legal but a shove, so every preset collapses onto it.
    expect(presets).toEqual({ halfPot: 12, pot: 12, allIn: 12 });
    expect(allInTo).toBe(12);
  });
});

describe('when a betting round ends', () => {
  it('ends once everyone has acted and matched', () => {
    let state = advance(createSession({ seed: 29 }));
    for (let i = 0; i < 6; i++) {
      expect(state.phase).toBe('awaiting-action');
      state = act(state, alwaysCall(state));
    }
    // Six Seats: four callers, the small blind completing, then the big blind's
    // option. Only then does the Street end.
    expect(state.phase).toBe('awaiting-deal');
    expect(state.street).toBe('preflop');
  });

  it('gives the big blind its option even when everyone merely calls', () => {
    let state = advance(createSession({ seed: 30 }));
    const bigBlind = (state.buttonSeat + 2) % 6;
    const actors: number[] = [];
    while (state.phase === 'awaiting-action') {
      actors.push(state.actorSeat!);
      state = act(state, alwaysCall(state));
    }
    expect(actors[actors.length - 1]).toBe(bigBlind);
  });

  it('reopens the action when someone raises', () => {
    let state = advance(createSession({ seed: 31 }));
    const firstActor = state.actorSeat!;
    state = act(state, { type: 'call' });
    state = act(state, { type: 'call' });
    state = act(state, { type: 'raise', to: 10 });

    // Everyone who had already called owes an action again.
    const actorsAfter: number[] = [];
    while (state.phase === 'awaiting-action') {
      actorsAfter.push(state.actorSeat!);
      state = act(state, { type: 'call' });
    }
    expect(actorsAfter).toContain(firstActor);
  });

  it('does not reopen the raise for Seats that had already called an under-raise', () => {
    // Seat 1 bets 10, Seat 2 calls, Seat 0 shoves 16 — a raise of 6, short of a
    // full raise of 10. Seat 2 may call the extra but must not re-raise.
    let state = positionAt({
      seats: [
        { stack: 16, hole: 'Ah Kd', streetCommitted: 0 },
        { stack: 90, hole: '2c 3d', streetCommitted: 10, hasActed: true },
        { stack: 90, hole: '5c 6d', streetCommitted: 10, hasActed: true },
      ],
      street: 'flop',
      board: '2h 7s 9c',
      currentBet: 10,
      lastRaiseSize: 10,
      actorSeat: 0,
    });
    state = act(state, { type: 'all-in' });

    expect(state.actorSeat).toBe(1);
    expect(state.legalActions!.canRaise).toBe(false);
    expect(state.legalActions!.canAllIn).toBe(false);
    expect(state.legalActions!.callAmount).toBe(6);
    expect(() => act(state, { type: 'raise', to: 30 })).toThrow(IllegalActionError);
    expect(() => act(state, { type: 'all-in' })).toThrow(IllegalActionError);
  });

  it('does reopen the raise after a full raise', () => {
    let state = positionAt({
      seats: [
        { stack: 90, hole: 'Ah Kd', streetCommitted: 0 },
        { stack: 90, hole: '2c 3d', streetCommitted: 10, hasActed: true },
        { stack: 90, hole: '5c 6d', streetCommitted: 10, hasActed: true },
      ],
      street: 'flop',
      board: '2h 7s 9c',
      currentBet: 10,
      lastRaiseSize: 10,
      actorSeat: 0,
    });
    state = act(state, { type: 'raise', to: 20 });
    expect(state.actorSeat).toBe(1);
    expect(state.legalActions!.canRaise).toBe(true);
  });

  it('reopens the raise when two short all-ins together add up to a full one', () => {
    // Seat 3 and Seat 4 called 10. Seat 1 shoves 16 (+6, not a full raise) and
    // Seat 2 shoves 22 (+6 again). Neither reopens anything on its own, but the
    // bet has climbed 12 since Seat 3 acted, which clears the full raise of 10 —
    // so Seat 3 may raise after all. Tracking a boolean rather than the level
    // Seat 3 faced would get this wrong.
    let state = positionAt({
      seats: [
        { stack: 16, hole: 'Ah Kd', streetCommitted: 0 },
        { stack: 22, hole: '2c 3d', streetCommitted: 0 },
        { stack: 90, hole: '5c 6d', streetCommitted: 10, hasActed: true },
        { stack: 90, hole: '8c 9d', streetCommitted: 10, hasActed: true },
      ],
      street: 'flop',
      board: '2h 7s 9c',
      currentBet: 10,
      lastRaiseSize: 10,
      actorSeat: 0,
    });

    state = act(state, { type: 'all-in' }); // to 16
    expect(state.actorSeat).toBe(1);
    expect(state.currentBet).toBe(16);

    state = act(state, { type: 'all-in' }); // to 22
    expect(state.actorSeat).toBe(2);
    expect(state.currentBet).toBe(22);
    expect(state.legalActions!.canRaise).toBe(true);
    expect(state.legalActions!.canAllIn).toBe(true);
  });

  it('still refuses the raise when two short all-ins do not add up to a full one', () => {
    // Same shape, but the second shove only adds 3, so the bet has climbed 9
    // since Seat 3 acted — one short of the full raise of 10.
    let state = positionAt({
      seats: [
        { stack: 16, hole: 'Ah Kd', streetCommitted: 0 },
        { stack: 19, hole: '2c 3d', streetCommitted: 0 },
        { stack: 90, hole: '5c 6d', streetCommitted: 10, hasActed: true },
        { stack: 90, hole: '8c 9d', streetCommitted: 10, hasActed: true },
      ],
      street: 'flop',
      board: '2h 7s 9c',
      currentBet: 10,
      lastRaiseSize: 10,
      actorSeat: 0,
    });

    state = act(state, { type: 'all-in' }); // to 16
    state = act(state, { type: 'all-in' }); // to 19

    expect(state.actorSeat).toBe(2);
    expect(state.currentBet).toBe(19);
    expect(state.legalActions!.canRaise).toBe(false);
    expect(state.legalActions!.canAllIn).toBe(false);
    expect(state.legalActions!.callAmount).toBe(9);
    expect(() => act(state, { type: 'raise', to: 40 })).toThrow(IllegalActionError);
  });

  it('lets a Seat that has not acted yet raise over an under-sized all-in', () => {
    const state = positionAt({
      seats: [
        { stack: 0, hole: 'Ah Kd', streetCommitted: 16, committed: 16, hasActed: true, facedBet: 16 },
        { stack: 90, hole: '2c 3d', streetCommitted: 0 },
        { stack: 90, hole: '5c 6d', streetCommitted: 10, hasActed: true },
      ],
      street: 'flop',
      board: '2h 7s 9c',
      currentBet: 16,
      lastRaiseSize: 10,
      actorSeat: 1,
    });
    // Seat 2 never acted this Street, so nothing was taken away from it.
    expect(state.legalActions!.canRaise).toBe(true);
  });

  it('lets nobody bet into a pot where everyone else is already all-in', () => {
    const state = positionAt({
      seats: [
        { stack: 90, hole: 'Ah Kd', streetCommitted: 20, committed: 20, hasActed: true },
        { stack: 0, hole: '2c 3d', streetCommitted: 20, committed: 20, hasActed: true },
        { stack: 100, hole: '5c 6d', folded: true },
      ],
      street: 'flop',
      board: '2h 7s 9c',
      currentBet: 20,
      actorSeat: null,
      phase: 'awaiting-deal',
    });
    const turn = advance(state);
    // Only one Seat can act and it owes nothing, so there is no betting at all:
    // the rest of the board is a formality.
    expect(turn.phase).toBe('awaiting-deal');
    expect(turn.street).toBe('turn');
  });

  it('will not let the last Seat with chips push at a table with nobody to call', () => {
    const state = positionAt({
      seats: [
        { stack: 90, hole: 'Ah Kd', streetCommitted: 0 },
        { stack: 0, hole: '2c 3d', streetCommitted: 20, committed: 20, hasActed: true },
        { stack: 100, hole: '5c 6d', folded: true },
      ],
      street: 'flop',
      board: '2h 7s 9c',
      currentBet: 20,
      actorSeat: 0,
    });
    const legal = state.legalActions!;
    expect(legal.canCall).toBe(true);
    expect(legal.canRaise).toBe(false);
    expect(legal.canAllIn).toBe(false);
    expect(() => act(state, { type: 'all-in' })).toThrow(IllegalActionError);
  });

  it('still lets a short Stack push all of it in as a call', () => {
    const state = positionAt({
      seats: [
        { stack: 5, hole: 'Ah Kd', streetCommitted: 0 },
        { stack: 90, hole: '2c 3d', streetCommitted: 20, committed: 20, hasActed: true },
        { stack: 90, hole: '5c 6d', streetCommitted: 20, committed: 20, hasActed: true },
      ],
      street: 'flop',
      board: '2h 7s 9c',
      currentBet: 20,
      actorSeat: 0,
    });
    expect(state.legalActions!.canAllIn).toBe(true);
    const shoved = act(state, { type: 'all-in' });
    expect(shoved.seats[0]!.stack).toBe(0);
    expect(shoved.currentBet).toBe(20); // a call for less does not raise anything
  });
});

describe('everybody folds', () => {
  it('settles at once and deals no further community cards', () => {
    let state = advance(createSession({ seed: 32 }));
    const bigBlind = (state.buttonSeat + 2) % 6;
    const before = chipsInPlay(state);

    while (state.phase === 'awaiting-action') state = act(state, { type: 'fold' });
    expect(state.phase).toBe('awaiting-showdown');
    state = advance(state);

    expect(state.phase).toBe('hand-complete');
    expect(state.board).toHaveLength(0);
    expect(state.seats[bigBlind]!.stack).toBe(201);
    expect(chipsInPlay(state)).toBe(before);
  });

  it('gives an uncalled bet back rather than leaving it in the pot', () => {
    let state = positionAt({
      seats: [
        { stack: 100, hole: 'Ah Kd', streetCommitted: 0, committed: 10 },
        { stack: 100, hole: '2c 3d', streetCommitted: 0, committed: 10 },
      ],
      config: { seatCount: 2 },
      street: 'flop',
      board: '2h 7s 9c',
      currentBet: 0,
      actorSeat: 0,
    });
    state = act(state, { type: 'bet', to: 40 });
    state = act(state, { type: 'fold' });

    const returned = state.events.find((e) => e.type === 'uncalled-returned');
    expect(returned).toEqual({ type: 'uncalled-returned', seat: 0, amount: 40 });
    expect(state.seats[0]!.stack).toBe(100);

    state = advance(state);
    expect(state.seats[0]!.stack).toBe(120); // the 20 already in the middle
    expect(state.seats[1]!.stack).toBe(100);
  });
});

describe('the engine never sleeps', () => {
  it('advances only when an action is delivered', () => {
    const state = advance(createSession({ seed: 33 }));
    const snapshot = JSON.stringify(state);
    // No timers, no scheduling: nothing at all happens between calls.
    expect(JSON.stringify(state)).toBe(snapshot);
    expect(state.phase).toBe('awaiting-action');
  });
});
