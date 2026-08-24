import { describe, expect, it } from 'vitest';
import { parseCards } from '../poker-math/cards.ts';
import { createSession, reduce } from './engine.ts';
import { awardPots, buildPots, totalPot } from './pots.ts';
import { chipsInPlay, displayPots, potForOdds } from './selectors.ts';
import { positionAt } from './test-fixtures.ts';
import type { SeatState, SessionState } from './types.ts';

const advance = (state: SessionState) => reduce(state, { type: 'advance' });

const seat = (index: number, committed: number, folded = false): SeatState => ({
  index,
  stack: 0,
  boughtIn: 200,
  holeCards: null,
  folded,
  committed,
  streetCommitted: committed,
  hasActed: true,
  facedBet: committed,
});

describe('buildPots', () => {
  it('makes one pot when everyone put in the same', () => {
    expect(buildPots([seat(0, 50), seat(1, 50), seat(2, 50)])).toEqual([
      { amount: 150, eligibleSeats: [0, 1, 2] },
    ]);
  });

  it('caps a short Stack out of the money above it', () => {
    // Seat 1 is all-in for 20; the other two put in 50 each.
    expect(buildPots([seat(0, 50), seat(1, 20), seat(2, 50)])).toEqual([
      { amount: 60, eligibleSeats: [0, 1, 2] },
      { amount: 60, eligibleSeats: [0, 2] },
    ]);
  });

  it('builds several side pots at once', () => {
    // Three different all-in sizes plus one deep Stack.
    const pots = buildPots([seat(0, 100), seat(1, 20), seat(2, 50), seat(3, 100)]);
    expect(pots).toEqual([
      { amount: 80, eligibleSeats: [0, 1, 2, 3] },
      { amount: 90, eligibleSeats: [0, 2, 3] },
      { amount: 100, eligibleSeats: [0, 3] },
    ]);
    expect(totalPot(pots)).toBe(270);
  });

  it('keeps a folded Seat’s chips in the pot but never lets it win them', () => {
    const pots = buildPots([seat(0, 50), seat(1, 50), seat(2, 30, true)]);
    expect(totalPot(pots)).toBe(130);
    for (const pot of pots) expect(pot.eligibleSeats).not.toContain(2);
  });

  it('conserves every chip put in, in every arrangement', () => {
    const arrangements = [
      [0, 0, 0],
      [5, 0, 0],
      [10, 10, 10],
      [7, 3, 11],
      [100, 20, 50],
      [1, 2, 3],
    ];
    for (const amounts of arrangements) {
      const seats = amounts.map((amount, i) => seat(i, amount));
      expect(totalPot(buildPots(seats))).toBe(amounts.reduce((a, b) => a + b, 0));
    }
  });
});

describe('awardPots', () => {
  const withCards = (index: number, committed: number, hole: string, folded = false): SeatState => {
    const cards = parseCards(hole);
    return { ...seat(index, committed, folded), holeCards: [cards[0]!, cards[1]!] };
  };

  it('settles each pot by the best hand among the Seats entitled to it', () => {
    // Seat 1 is all-in for 20 with the best hand: it wins the main pot but has no
    // claim on the side pot, which goes to the better of the other two.
    const seats = [
      withCards(0, 100, 'Kh Kd'),
      withCards(1, 20, 'Ah Ad'),
      withCards(2, 100, 'Qh Qd'),
    ];
    const board = parseCards('2h 5s 9c Jd 3s');
    const awards = awardPots(buildPots(seats), seats, board, [0, 1, 2]);

    expect(awards[0]!.amount).toBe(60);
    expect(awards[0]!.winners.map((w) => w.seat)).toEqual([1]);
    expect(awards[1]!.amount).toBe(160);
    expect(awards[1]!.winners.map((w) => w.seat)).toEqual([0]);
  });

  it('splits a pot between equal hands', () => {
    const seats = [withCards(0, 50, 'Ah Kd'), withCards(1, 50, 'As Kc')];
    const awards = awardPots(buildPots(seats), seats, parseCards('2h 5s 9c Jd 3s'), [0, 1]);
    expect(awards[0]!.winners.map((w) => w.amount)).toEqual([50, 50]);
    expect(awards[0]!.oddChipSeat).toBeNull();
  });

  it('gives an odd chip to the first winner clockwise from the Button', () => {
    // Two equal hands and a folded Seat's single chip, so the contested pot is 51
    // and does not divide in two. Note an *uncalled* extra chip would never get
    // this far — it forms its own side pot and goes straight back.
    const seats = [
      withCards(0, 25, 'Ah Kd'),
      withCards(1, 25, 'As Kc'),
      withCards(2, 1, '7c 2d', true),
    ];
    const pots = buildPots(seats);
    expect(totalPot(pots)).toBe(51);

    // Button on Seat 2, so the order round the table starts at Seat 0.
    const fromSeatZero = awardPots(pots, seats, parseCards('2h 5s 9c Jd 3s'), [0, 1, 2]);
    expect(fromSeatZero[0]!.oddChipSeat).toBe(0);
    // Button on Seat 0, so it starts at Seat 1 and the odd chip moves with it.
    const fromSeatOne = awardPots(pots, seats, parseCards('2h 5s 9c Jd 3s'), [1, 2, 0]);
    expect(fromSeatOne[0]!.oddChipSeat).toBe(1);

    for (const awards of [fromSeatZero, fromSeatOne]) {
      const paid = awards.flatMap((a) => a.winners).reduce((sum, w) => sum + w.amount, 0);
      expect(paid).toBe(51); // the remainder is never dropped
    }
  });

  it('hands an uncontested pot over without a showdown', () => {
    const seats = [withCards(0, 50, 'Ah Kd'), withCards(1, 50, '2c 3d', true)];
    const awards = awardPots(buildPots(seats), seats, [], [0, 1]);
    expect(awards[0]!.winners).toEqual([{ seat: 0, amount: 100, handValue: null, bestFive: null }]);
  });

  it('pays out exactly what went in, whatever the shape', () => {
    const seats = [
      withCards(0, 100, 'Ah Ad'),
      withCards(1, 20, 'Kh Kd'),
      withCards(2, 55, 'Qh Qd'),
      withCards(3, 100, 'Jh Jd'),
      withCards(4, 33, '2c 7d', true),
    ];
    const pots = buildPots(seats);
    const awards = awardPots(pots, seats, parseCards('2h 5s 9c Td 3s'), [0, 1, 2, 3, 4]);
    const paid = awards.flatMap((a) => a.winners).reduce((sum, w) => sum + w.amount, 0);
    expect(paid).toBe(100 + 20 + 55 + 100 + 33);
  });
});

describe('all-in through the reducer', () => {
  it('creates a side pot the short Stack cannot win', () => {
    let state = positionAt({
      seats: [
        { stack: 20, hole: 'Ah Ad', streetCommitted: 0 },
        { stack: 100, hole: 'Kh Kd', streetCommitted: 0 },
        { stack: 100, hole: 'Qh Qd', streetCommitted: 0 },
      ],
      street: 'flop',
      board: '2h 5s 9c',
      deck: '7d 8c',
      currentBet: 0,
      actorSeat: 0,
    });
    const before = chipsInPlay(state);

    state = reduce(state, { type: 'all-in' }); // Seat 0 pushes its last 20
    state = reduce(state, { type: 'raise', to: 100 }); // Seat 1 shoves over it
    state = reduce(state, { type: 'call' });

    expect(state.pots).toEqual([
      { amount: 60, eligibleSeats: [0, 1, 2] },
      { amount: 160, eligibleSeats: [1, 2] },
    ]);

    while (state.phase !== 'hand-complete') state = advance(state);

    // Aces hold: Seat 0 takes the main pot but has no claim on the side pot,
    // which Seat 1's kings take off the queens.
    expect(state.seats[0]!.stack).toBe(60);
    expect(state.seats[1]!.stack).toBe(160);
    expect(state.seats[2]!.stack).toBe(0);
    expect(chipsInPlay(state)).toBe(before);
  });

  it('runs the rest of the board out once nobody can act', () => {
    let state = positionAt({
      seats: [
        { stack: 50, hole: 'Ah Ad', streetCommitted: 0 },
        { stack: 50, hole: 'Kh Kd', streetCommitted: 0 },
      ],
      config: { seatCount: 2 },
      street: 'flop',
      board: '2h 5s 9c',
      currentBet: 0,
      actorSeat: 0,
    });
    state = reduce(state, { type: 'all-in' });
    state = reduce(state, { type: 'call' });

    // Both are all-in, so the cards go face up before the run-out and the UI
    // paces the remaining Streets one at a time.
    expect(state.events.some((e) => e.type === 'all-in-runout')).toBe(true);
    expect(state.revealedSeats).toEqual([0, 1]);
    expect(state.phase).toBe('awaiting-deal');

    state = advance(state);
    expect(state.street).toBe('turn');
    expect(state.phase).toBe('awaiting-deal'); // still no betting, one card at a time

    state = advance(state);
    expect(state.street).toBe('river');
    expect(state.phase).toBe('awaiting-showdown');
  });

  it('lets a short Stack win the main pot while the side pot goes elsewhere', () => {
    let state = positionAt({
      seats: [
        { stack: 0, hole: 'Ah Ad', committed: 10, streetCommitted: 10, hasActed: true },
        { stack: 40, hole: '7c 2d', committed: 60, streetCommitted: 60, hasActed: true },
        { stack: 40, hole: 'Kh Kd', committed: 60, streetCommitted: 60, hasActed: true },
      ],
      board: '3h 5s 9c Jd 4s',
      street: 'river',
      phase: 'awaiting-showdown',
      actorSeat: null,
    });
    const before = chipsInPlay(state);
    state = advance(state);

    expect(state.seats[0]!.stack).toBe(30); // main pot: 10 x 3
    expect(state.seats[2]!.stack).toBe(140); // side pot: 50 x 2, on top of 40
    expect(state.seats[1]!.stack).toBe(40);
    expect(chipsInPlay(state)).toBe(before);
  });

  it('splits a side pot and still conserves the chips', () => {
    let state = positionAt({
      seats: [
        { stack: 0, hole: '2c 3d', committed: 11, streetCommitted: 11, hasActed: true },
        { stack: 0, hole: 'Ah Kd', committed: 40, streetCommitted: 40, hasActed: true },
        { stack: 0, hole: 'As Kc', committed: 40, streetCommitted: 40, hasActed: true },
      ],
      board: '7h 9s Tc Jd 4s',
      street: 'river',
      phase: 'awaiting-showdown',
      actorSeat: null,
    });
    const before = chipsInPlay(state);
    state = advance(state);

    // Main pot 33 splits between the two equal hands (16/17 with the odd chip),
    // side pot 58 splits 29/29.
    expect(state.seats[0]!.stack).toBe(0);
    expect(state.seats[1]!.stack + state.seats[2]!.stack).toBe(91);
    expect(Math.abs(state.seats[1]!.stack - state.seats[2]!.stack)).toBe(1);
    expect(chipsInPlay(state)).toBe(before);
  });

  it('reports each pot separately so the table can show them', () => {
    const state = advance(
      positionAt({
        seats: [
          { stack: 0, hole: 'Ah Ad', committed: 10, streetCommitted: 10, hasActed: true },
          { stack: 0, hole: '7c 2d', committed: 60, streetCommitted: 60, hasActed: true },
          { stack: 0, hole: 'Kh Kd', committed: 60, streetCommitted: 60, hasActed: true },
        ],
        board: '3h 5s 9c Jd 4s',
        street: 'river',
        phase: 'awaiting-showdown',
        actorSeat: null,
      }),
    );
    const awards = state.events.filter((e) => e.type === 'pot-awarded');
    expect(awards).toHaveLength(2);
    expect(awards[0]).toMatchObject({ potIndex: 0, amount: 30 });
    expect(awards[1]).toMatchObject({ potIndex: 1, amount: 100 });
  });
});

describe('what the table shows as the pot', () => {
  it('does not call an unmatched big blind a side pot', () => {
    // The settlement decomposition is right to split here — only the big blind
    // is eligible for its own unmatched chip — but showing that on the felt as
    // "side pot 1" before anyone has acted is nonsense.
    const state = reduce(createSession({ seed: 55 }), { type: 'advance' });
    expect(state.pots.length).toBeGreaterThan(1);
    expect(displayPots(state)).toEqual([]);
  });

  it('leaves the current Street’s bets in front of the Seats, not in the pot', () => {
    const state = positionAt({
      seats: [
        { stack: 80, hole: 'Ah Kd', committed: 30, streetCommitted: 10 },
        { stack: 80, hole: '2c 3d', committed: 30, streetCommitted: 10 },
        { stack: 100, hole: '5c 6d', committed: 20, streetCommitted: 0, folded: true },
      ],
      street: 'turn',
      board: '2h 7s 9c Jd',
      currentBet: 10,
      actorSeat: 2,
    });
    // 20 + 20 gathered from earlier Streets, plus the folded Seat's 20.
    expect(displayPots(state)).toEqual([{ amount: 60, eligibleSeats: [0, 1] }]);
    // ...and the whole middle, bets included, is what pot odds are read off.
    expect(potForOdds(state)).toBe(80);
  });

  it('still shows a real side pot once a Street with an all-in has closed', () => {
    const state = positionAt({
      seats: [
        { stack: 0, hole: 'Ah Kd', committed: 20, streetCommitted: 0 },
        { stack: 80, hole: '2c 3d', committed: 60, streetCommitted: 0 },
        { stack: 80, hole: '5c 6d', committed: 60, streetCommitted: 0 },
      ],
      street: 'turn',
      board: '2h 7s 9c Jd',
      currentBet: 0,
      actorSeat: 1,
    });
    expect(displayPots(state)).toEqual([
      { amount: 60, eligibleSeats: [0, 1, 2] },
      { amount: 80, eligibleSeats: [1, 2] },
    ]);
  });
});

describe('chip conservation', () => {
  it('holds across settlement in every shape tried', () => {
    const shapes = [
      [
        { stack: 0, hole: 'Ah Ad', committed: 10 },
        { stack: 0, hole: 'Kh Kd', committed: 10 },
        { stack: 0, hole: 'Qh Qd', committed: 10 },
      ],
      [
        { stack: 5, hole: 'Ah Ad', committed: 13 },
        { stack: 0, hole: 'Kh Kd', committed: 47 },
        { stack: 9, hole: 'Qh Qd', committed: 47 },
      ],
      [
        { stack: 0, hole: 'Ah Kd', committed: 33 },
        { stack: 0, hole: 'As Kc', committed: 33 },
        { stack: 0, hole: 'Ac Kh', committed: 33 },
      ],
      [
        { stack: 1, hole: '2c 3d', committed: 1 },
        { stack: 0, hole: 'Ah Ad', committed: 99 },
        { stack: 0, hole: 'Kh Kd', committed: 99, folded: true },
      ],
    ];

    for (const seats of shapes) {
      const start = positionAt({
        seats: seats.map((s) => ({ ...s, streetCommitted: s.committed, hasActed: true })),
        board: '7h 9s Tc 5d 4s',
        street: 'river',
        phase: 'awaiting-showdown',
        actorSeat: null,
      });
      const settled = advance(start);
      expect(chipsInPlay(settled)).toBe(chipsInPlay(start));
      for (const s of settled.seats) expect(s.stack).toBeGreaterThanOrEqual(0);
    }
  });
});
