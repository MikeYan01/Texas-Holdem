import { describe, expect, it } from 'vitest';
import { DECK_SIZE, formatCard, parseCards, type Card } from './cards.ts';
import { computeEquity, getEquity } from './equity.ts';
import { monteCarloEquity } from './equity-core.ts';
import { PREFLOP_EQUITY, lookupPreflop } from './preflop-equity.ts';
import {
  allCanonicalLabels,
  canonicalHandLabel,
  representativeCards,
} from './starting-hands.ts';
import { seededRng } from './rng.ts';

const hole = (text: string): [Card, Card] => {
  const cards = parseCards(text);
  return [cards[0]!, cards[1]!];
};

const equityOf = (holeText: string, board: string, opponentCount: number, seed = 1) =>
  computeEquity({
    hole: hole(holeText),
    board: parseCards(board),
    opponentCount,
    rng: seededRng(seed),
  });

/** The equity a cell of the table holds, for the tests that read it directly. */
const cellEquity = (label: string, opponentCount = 1) => lookupPreflop(label, opponentCount)!.equity;

describe('the preflop table', () => {
  it('agrees with the published figures', () => {
    // The table is the source; these are the four numbers the ticket names.
    // Tolerance is half a point — the sampling error behind each cell is about
    // 0.11% (1 sigma) at 200k iterations.
    expect(equityOf('Ah Ad', '', 1).equity * 100).toBeCloseTo(85.2, 0);
    expect(equityOf('Kh Kd', '', 1).equity * 100).toBeCloseTo(82.4, 0);
    expect(equityOf('Ah Kh', '', 1).equity * 100).toBeCloseTo(67.0, 0);
    expect(equityOf('Ah Ad', '', 5).equity * 100).toBeCloseTo(49.2, 0);
  });

  it('was generated here, not copied from anywhere', () => {
    expect(PREFLOP_EQUITY.note).toContain('scripts/generate-preflop-table.ts');
    expect(PREFLOP_EQUITY.note).toContain('No published or copyrighted');
    expect(PREFLOP_EQUITY.iterations).toBeGreaterThanOrEqual(100_000);
  });

  it('says out loud that it was sampled rather than enumerated', () => {
    // The cells are honest about what they are: a lookup that costs nothing at
    // the table, carrying the sampling error of the run that produced it.
    expect(PREFLOP_EQUITY.method).toContain('Monte Carlo');
    expect(PREFLOP_EQUITY.note).toContain('1-sigma');
    expect(PREFLOP_EQUITY.seed).toEqual(expect.any(Number));
  });

  it('reports how often a hand wins outright and how often it chops', () => {
    // A lookup that filled in `tie: 0` would be claiming aces never split, which
    // is false about one hand in two hundred.
    const aces = equityOf('Ah Ad', '', 1);
    expect(aces.win).toBeGreaterThan(0.84);
    expect(aces.win).toBeLessThan(aces.equity);
    expect(aces.tie).toBeGreaterThan(0);
    expect(aces.equity).toBeCloseTo(aces.win + aces.tie / 2, 5);
    // 72o chops far more often than aces do — it wins by playing the board.
    expect(equityOf('7d 2c', '', 1).tie).toBeGreaterThan(aces.tie * 5);
  });

  it('covers all 169 canonical hands against one to five opponents', () => {
    const labels = allCanonicalLabels();
    expect(labels).toHaveLength(169);
    expect(new Set(labels).size).toBe(169);
    for (const label of labels) {
      const row = PREFLOP_EQUITY.table[label];
      expect(row, label).toHaveLength(5);
      for (let opponents = 1; opponents <= 5; opponents++) {
        const cell = lookupPreflop(label, opponents)!;
        expect(cell.equity, label).toBeGreaterThan(0);
        expect(cell.equity, label).toBeLessThanOrEqual(1);
        // Every cell carries its own win and tie, not a fabrication from the
        // equity: rounding to six decimals is the only slack between them.
        expect(cell.equity, label).toBeCloseTo(cell.win + cell.tie / 2, 5);
      }
    }
  });

  it('gets worse for every hand as opponents are added', () => {
    for (const label of allCanonicalLabels()) {
      for (let opponents = 2; opponents <= 5; opponents++) {
        expect(cellEquity(label, opponents), `${label} vs ${opponents}`).toBeLessThan(
          cellEquity(label, opponents - 1),
        );
      }
    }
  });

  it('ranks the hands the way anyone who plays would expect', () => {
    const better = (a: string, b: string) =>
      expect(cellEquity(a), `${a} > ${b}`).toBeGreaterThan(cellEquity(b));
    better('AA', 'KK');
    better('KK', 'QQ');
    better('AKs', 'AKo'); // suited is worth something
    better('AKs', 'A2s');
    better('22', '72o');
    better('JTs', 'J2s'); // connected is worth something
  });

  it('averages out to a coin flip across every possible holding, as it must', () => {
    // Weighted by how often each shape is dealt: 6 combinations for a pair, 4
    // suited, 12 offsuit. Against one random opponent the whole field has to
    // average one half, which no single cell can fake.
    let total = 0;
    let weight = 0;
    for (const label of allCanonicalLabels()) {
      const combos = label.length === 2 ? 6 : label[2] === 's' ? 4 : 12;
      total += cellEquity(label) * combos;
      weight += combos;
    }
    expect(weight).toBe(1326);
    expect(total / weight).toBeCloseTo(0.5, 2);
  });

  it('gives the same answer whatever suits the hand happens to arrive in', () => {
    expect(equityOf('Ah Kh', '', 3).equity).toBe(equityOf('As Ks', '', 3).equity);
    expect(equityOf('Ah Kd', '', 3).equity).toBe(equityOf('As Kc', '', 3).equity);
    expect(equityOf('Ah Kh', '', 3).equity).not.toBe(equityOf('Ah Kd', '', 3).equity);
  });

  it('has an answer for every one of the 1326 holdings anyone can be dealt', () => {
    // The canonical collapse is only worth anything if nothing falls through it.
    let holdings = 0;
    for (let a = 0; a < DECK_SIZE; a++) {
      for (let b = a + 1; b < DECK_SIZE; b++) {
        const result = computeEquity({
          hole: [a, b],
          board: [],
          opponentCount: 5,
          rng: seededRng(1),
        });
        expect(result.method, `${formatCard(a)} ${formatCard(b)}`).toBe('preflop-table');
        expect(result.equity, `${formatCard(a)} ${formatCard(b)}`).toBeGreaterThan(0);
        holdings++;
      }
    }
    expect(holdings).toBe(1326);
  });
});

describe('canonical labels', () => {
  it('reduces a holding to its ranks and whether they are suited', () => {
    expect(canonicalHandLabel(...hole('Ah Ad'))).toBe('AA');
    expect(canonicalHandLabel(...hole('Ah Kh'))).toBe('AKs');
    expect(canonicalHandLabel(...hole('Kh Ah'))).toBe('AKs'); // order does not matter
    expect(canonicalHandLabel(...hole('7d 2c'))).toBe('72o');
  });

  it('round-trips through a representative holding', () => {
    for (const label of allCanonicalLabels()) {
      expect(canonicalHandLabel(...representativeCards(label))).toBe(label);
    }
  });
});

describe('picking a method by Street', () => {
  it('looks preflop up rather than simulating it', () => {
    expect(equityOf('Ah Ad', '', 3).method).toBe('preflop-table');
  });

  it('samples the flop and the turn', () => {
    expect(equityOf('Ah Ad', '2h 7s 9c', 3).method).toBe('monte-carlo');
    expect(equityOf('Ah Ad', '2h 7s 9c Jd', 3).method).toBe('monte-carlo');
    expect(equityOf('Ah Ad', '2h 7s 9c', 3).samples).toBe(2000);
  });

  it('enumerates a heads-up river exactly, every one of the 990 hands', () => {
    const result = equityOf('Ah Ad', '2h 7s 9c Jd 3s', 1);
    expect(result.method).toBe('exact-enumeration');
    // The spec says C(44,2) = 946; that is off by one card. Seven are known —
    // two in hand, five on the board — leaving 45 unknown, so the opponent has
    // C(45,2) = 990 possible holdings. Enumerating 946 of them would not be
    // exact.
    expect(result.samples).toBe(990);
  });

  it('says monte-carlo on a multi-way river rather than claiming to be exact', () => {
    // Enumerating n opponents jointly is 990^n. Falling back is honest; silently
    // calling the fallback "exact" would not be.
    expect(equityOf('Ah Ad', '2h 7s 9c Jd 3s', 3).method).toBe('monte-carlo');
  });

  it('honours a requested iteration count where sampling is what happens', () => {
    expect(equityOf('Ah Ad', '2h 7s 9c', 2).samples).toBe(2000);
    expect(
      computeEquity({
        hole: hole('Ah Ad'),
        board: parseCards('2h 7s 9c'),
        opponentCount: 2,
        rng: seededRng(1),
        iterations: 500,
      }).samples,
    ).toBe(500);
  });

  it('samples a preflop spot with more opponents than the table was built for', () => {
    // The table stops at five opponents because a table seats six. Asked about a
    // bigger game it samples instead of throwing, and `method` gives it away.
    const beyond = equityOf('Ah Ad', '', 8, 7);
    expect(beyond.method).toBe('monte-carlo');
    expect(beyond.equity).toBeGreaterThan(0);
    expect(beyond.equity).toBeLessThan(cellEquity('AA', 5));
  });

  it('reports the same equity every method claims: win plus half the chops', () => {
    const boards = ['', '2h 7s 9c', '2h 7s 9c Jd', '2h 7s 9c Jd 3s'];
    for (const board of boards) {
      for (const opponents of [1, 3]) {
        const result = equityOf('Ah Kd', board, opponents, 5);
        expect(result.equity, `${board || 'preflop'} vs ${opponents}`).toBeCloseTo(
          result.win + result.tie / 2,
          5,
        );
      }
    }
  });
});

describe('refusing what it cannot answer', () => {
  const ask = (holeText: string, board: string, opponentCount: number) => () =>
    equityOf(holeText, board, opponentCount);

  it('will not price a hand against nobody', () => {
    expect(ask('Ah Ad', '', 0)).toThrow();
    expect(ask('Ah Ad', '', -1)).toThrow();
    expect(ask('Ah Ad', '', 1.5)).toThrow();
  });

  it('will not accept a board that is not a real Street', () => {
    expect(ask('Ah Ad', '2h', 1)).toThrow();
    expect(ask('Ah Ad', '2h 7s', 1)).toThrow();
    expect(ask('Ah Ad', '2h 7s 9c Jd 3s 4d', 1)).toThrow();
  });

  it('will not accept a card that is in two places at once', () => {
    // Left unchecked this shortens the deck and the loop reads off the end of it,
    // which produces a plausible-looking number that is simply wrong.
    expect(ask('Ah Ah', '', 1)).toThrow();
    expect(ask('Ah Ad', '2h 7s Ah', 1)).toThrow();
    expect(ask('Ah Ad', '2h 7s 7s', 1)).toThrow();
  });

  it('will not accept something that is not a card at all', () => {
    expect(() =>
      computeEquity({ hole: [52, 0], board: [], opponentCount: 1, rng: seededRng(1) }),
    ).toThrow();
    expect(() =>
      computeEquity({ hole: [-1, 0], board: [], opponentCount: 1, rng: seededRng(1) }),
    ).toThrow();
  });

  it('will not deal more hands than there are cards', () => {
    expect(ask('Ah Ad', '2h 7s 9c', 24)).toThrow();
  });
});

describe('the answers themselves', () => {
  it('gives the nuts a hundred percent', () => {
    // A royal flush on the river. Nothing ties it, because the two cards that
    // would are in our hand.
    const result = equityOf('Jh Th', 'Ah Kh Qh 2c 3d', 1);
    expect(result.equity).toBe(1);
    expect(result.win).toBe(1);
    expect(result.tie).toBe(0);
  });

  it('splits every time when the board is the best hand available', () => {
    // A royal flush lying on the board: nobody can beat it and nobody can miss
    // it, so every single one of the 990 holdings is a tie.
    const result = equityOf('2c 3d', 'Ah Kh Qh Jh Th', 1);
    expect(result.win).toBe(0);
    expect(result.tie).toBe(1);
    expect(result.equity).toBe(0.5);
  });

  it('gives a drawing-dead hand the floor, which is not zero', () => {
    // Board: four hearts to the ace and a deuce. Holding 3d 4d there is no card
    // and no combination that ever wins — every opponent holding either makes a
    // flush, a straight, a pair, or simply plays the board with a better kicker.
    //
    // It still is not zero, and cannot be: both players may play the board, so a
    // hand that cannot win can always chop. Here exactly four of the 990
    // holdings (a three and a four, neither of them a heart) chop, which is the
    // real floor — 0.2%, not 0%. Claiming 0 would be the wrong kind of tidy.
    const dead = equityOf('3d 4d', 'Ah Kh Qh Jh 2c', 1);
    expect(dead.method).toBe('exact-enumeration');
    expect(dead.win).toBe(0);
    expect(dead.tie * dead.samples).toBe(4);
    expect(dead.equity).toBeCloseTo(2 / 990, 10);
  });

  it('lets a hand that can only chop chop, and counts exactly how often', () => {
    // A king-high straight flush is already on the board. Only the ace of hearts
    // beats it, so the 44 holdings containing it win and the other 946 split.
    const chops = equityOf('2c 3d', '9h Th Jh Qh Kh', 1);
    expect(chops.win).toBe(0);
    expect(chops.tie * chops.samples).toBe(946);
    expect(chops.equity).toBeCloseTo(473 / 990, 10);
  });

  it('stays between nothing and everything, whatever it is asked', () => {
    const boards = ['', '2h 7s 9c', '2h 7s 9c Jd', '2h 7s 9c Jd 3s'];
    for (const board of boards) {
      for (let opponents = 1; opponents <= 5; opponents++) {
        const { equity } = equityOf('Ah Kd', board, opponents, opponents + board.length);
        expect(equity).toBeGreaterThanOrEqual(0);
        expect(equity).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is worth less against more opponents on the flop as well', () => {
    const heads = equityOf('Ah Kd', '2h 7s 9c', 1, 9).equity;
    const sixWay = equityOf('Ah Kd', '2h 7s 9c', 5, 9).equity;
    expect(sixWay).toBeLessThan(heads);
  });

  it('rates a made hand above a busted one on the same board', () => {
    const set = equityOf('9h 9d', '2h 7s 9c', 2, 4).equity;
    const nothing = equityOf('4h 3d', '2h 7s 9c', 2, 4).equity;
    expect(set).toBeGreaterThan(nothing);
  });
});

describe('exact enumeration and sampling agree', () => {
  it('converges to the enumerated answer given enough iterations', () => {
    const heroHole = hole('Ah Kd');
    const board = parseCards('2h 7s 9c Jd 3s');
    const exact = computeEquity({ hole: heroHole, board, opponentCount: 1, rng: seededRng(1) });
    const sampled = monteCarloEquity({
      hole: heroHole,
      board,
      opponentCount: 1,
      rng: seededRng(20_260_824),
      iterations: 200_000,
    });
    expect(exact.method).toBe('exact-enumeration');
    expect(sampled.equity).toBeCloseTo(exact.equity, 2);
  });
});

describe('reproducibility', () => {
  it('gives the same answer twice from the same seed', () => {
    expect(equityOf('Ah Kd', '2h 7s 9c', 3, 12).equity).toBe(
      equityOf('Ah Kd', '2h 7s 9c', 3, 12).equity,
    );
  });

  it('gives different answers from different seeds, as sampling should', () => {
    expect(equityOf('Ah Kd', '2h 7s 9c', 3, 1).equity).not.toBe(
      equityOf('Ah Kd', '2h 7s 9c', 3, 2).equity,
    );
  });
});

describe('the async interface', () => {
  it('is what callers use, so the work can move off the main thread later', async () => {
    const promise = getEquity({
      hole: hole('Ah Ad'),
      board: parseCards('2h 7s 9c'),
      opponentCount: 2,
      rng: seededRng(3),
    });
    expect(promise).toBeInstanceOf(Promise);
    const result = await promise;
    expect(result.equity).toBeGreaterThan(0.5);
  });

  it('refuses a request with nobody to beat', async () => {
    await expect(
      getEquity({ hole: hole('Ah Ad'), board: [], opponentCount: 0, rng: seededRng(1) }),
    ).rejects.toThrow();
  });
});

describe('performance baseline', () => {
  // These exist to catch a change of scale — an allocation creeping back into the
  // loop, a copy of the deck per iteration — not to pin a number down. Every bar
  // is set two orders of magnitude above what the code actually measures, so it
  // survives a loaded CI box and still fails the day the loop stops being flat.
  const timeOneCall = (boardText: string, opponentCount: number): number => {
    const heroHole = hole('Th 7d');
    const board = parseCards(boardText);
    const once = (seed: number) =>
      monteCarloEquity({ hole: heroHole, board, opponentCount, rng: seededRng(seed), iterations: 2000 });
    for (let i = 0; i < 5; i++) once(i); // Warm up, so this is not the first-tier compile.

    const started = globalThis.performance.now();
    once(99);
    return globalThis.performance.now() - started;
  };

  it('answers the heaviest question there is — six-handed, nothing dealt — in milliseconds', () => {
    // Five opponents and all five community cards still to come. Measured around
    // 4 ms for the 2000 iterations the Bots actually ask for.
    expect(timeOneCall('', 5)).toBeLessThan(200);
  });

  it('answers a six-handed flop the same way', () => {
    expect(timeOneCall('Ah 9s 4c', 5)).toBeLessThan(200);
  });

  it('runs a six-handed flop decision for every Bot inside a frame, with room to spare', () => {
    const heroHole = hole('Th 7d');
    const board = parseCards('Ah 9s 4c');
    // Warm up, so the measurement is not the first-tier compile.
    for (let i = 0; i < 5; i++) {
      monteCarloEquity({ hole: heroHole, board, opponentCount: 5, rng: seededRng(i), iterations: 2000 });
    }

    const started = globalThis.performance.now();
    for (let bot = 0; bot < 5; bot++) {
      monteCarloEquity({
        hole: heroHole,
        board,
        opponentCount: 5,
        rng: seededRng(bot),
        iterations: 2000,
      });
    }
    const elapsed = globalThis.performance.now() - started;
    // Measured around 7 ms for all five Bots. The bar is set two orders of
    // magnitude above that: this only ever catches a change of scale, such as
    // allocating inside the loop again.
    expect(elapsed).toBeLessThan(700);
  });
});
