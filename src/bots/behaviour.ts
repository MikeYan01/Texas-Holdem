// What the Bots are *doing*, as opposed to how many chips they are winning.
//
// The balance readout (ADR-0006) answers "is anybody a cash machine". It cannot
// answer the Player's actual complaint — that the Bots are stupid — because five
// Bots made equally smarter move chips per Hand hardly at all. These are the
// counters that turn "they feel stupid" into numbers.
//
// They are accumulated inside the one existing experiment rather than in a second
// one, for the reason ADR-0006 gives: a tool and the assertion it guards must be
// measuring the same thing, and two experiments drift.
//
// Nothing in here is asserted except the differentiation floor. Numbers of this
// kind are for reading while tuning; asserting them would lock tuning down, which
// is the same reasoning that keeps the personality tests on relative ordering.

import { STREETS, type PlayerAction, type Street } from '../engine/types.ts';
import { A_NEAR_CERTAIN_WINNER, type DecisionReasons } from './decide.ts';
import { PERSONALITY_KEYS } from './personalities.ts';
import type { BotView, PersonalityKey } from './types.ts';

/** Stack depth in big blinds at the moment of the decision. */
export const STACK_DEPTHS = ['<5', '5-10', '10-20', '>20'] as const;
export type StackDepth = (typeof STACK_DEPTHS)[number];

/** True Equity behind a bet, in fifths. `<20` is air; `>80` is the nuts. */
export const EQUITY_BANDS = ['<20', '20-40', '40-60', '60-80', '>80'] as const;
export type EquityBand = (typeof EQUITY_BANDS)[number];

/** What a Seat did on the flop, which is what the turn is then read against. */
export const FLOP_ROLES = ['bluffed', 'value-bet', 'checked'] as const;
export type FlopRole = (typeof FLOP_ROLES)[number];

/** A bet of this share of the pot or more is what the Player reads as "big". */
export const A_BIG_BET = 0.6;
/** Under this much Equity behind a big bet, the Reveal shows air. */
export const AIR = 0.2;

export type StreetTally = { decisions: number; aggressive: number; bluffDriven: number };
export type DepthTally = { decisions: number; aggressive: number; allIns: number };
export type TurnTally = { reached: number; fired: number; bluffed: number; checked: number };

export type PersonalityBehaviour = {
  readonly key: PersonalityKey;
  /** Decisions where a bet or raise was legal — the only fair denominator. */
  readonly openable: number;
  readonly aggressive: number;
  readonly bluffDriven: number;
  /** Share of this Bot's aggression the Player would call a bluff at the Reveal. */
  readonly bluffShare: number;
  readonly postflopBluffsPerSession: number;
  readonly byStreet: Readonly<Record<Street, StreetTally>>;
  /** Aggression rate per Street, over decisions where aggression was legal. */
  readonly aggressionByStreet: Readonly<Record<Street, number>>;
  readonly bigBets: number;
  readonly bigBetEquity: Readonly<Record<EquityBand, number>>;
  readonly bigBetsWithAirPerSession: number;
  readonly allIns: number;
  readonly allInsPerSession: number;
  /** All-ins the Bot chose, rather than ones the legal maximum chose for it. */
  readonly chosenGambles: number;
  /** Mean Upside behind a chosen push, against short-Stack spots generally. */
  readonly upsideAtPush: number;
  readonly upsideWhenShort: number;
  readonly byDepth: Readonly<Record<StackDepth, DepthTally>>;
  /** Share of all-ins pushed from under 10 BB. The 5.5x over-representation. */
  readonly allInsFromShort: number;
  /** Intended raises the legal maximum decided for the Bot by clamping down. */
  readonly clampedDownShare: number;
  readonly twoBarrelsPerSession: number;
  /** Checks made holding a near-lock with betting legal. Should be zero. */
  readonly checksHoldingALock: number;
  /** The highest true Equity this Bot ever checked with betting legal. */
  readonly highestEquityChecked: number;
  /** Folds of a Hand the same decision had just found strong enough to raise. */
  readonly foldsItWantedToRaise: number;
  /** What it did on the turn, given what it had done on the flop. */
  readonly turnAfterFlop: Readonly<Record<FlopRole, TurnTally>>;
};

export type BehaviourReport = {
  readonly sessions: number;
  readonly hands: number;
  readonly decisions: number;
  readonly perPersonality: readonly PersonalityBehaviour[];
  /** Six Seats are dealt in; this is how many are still there for the flop. */
  readonly meanLiveSeatsAtFlop: number;
  readonly threeHandedFlopShare: number;
  readonly rebuysPer100Hands: number;
  /** Across the field: bluff-driven share of all aggression. */
  readonly bluffShare: number;
  readonly allInsPerSession: number;
  readonly allInsFromShort: number;
  readonly clampedDownShare: number;
  readonly bigBetsWithAirPerSession: number;
  readonly twoBarrelsPerSession: number;
  readonly checksHoldingALock: number;
  /**
   * The spread across the five personalities on the two properties a Player
   * reads them by. This is the one behavioural number that is asserted: without
   * it the table can quietly collapse into five copies of one Bot.
   */
  readonly spread: { readonly bluffShare: number; readonly allInsPerSession: number };
};

const zeroStreets = (): Record<Street, StreetTally> =>
  Object.fromEntries(
    STREETS.map((street) => [street, { decisions: 0, aggressive: 0, bluffDriven: 0 }]),
  ) as Record<Street, StreetTally>;

const zeroDepths = (): Record<StackDepth, DepthTally> =>
  Object.fromEntries(
    STACK_DEPTHS.map((depth) => [depth, { decisions: 0, aggressive: 0, allIns: 0 }]),
  ) as Record<StackDepth, DepthTally>;

const zeroBands = (): Record<EquityBand, number> =>
  Object.fromEntries(EQUITY_BANDS.map((band) => [band, 0])) as Record<EquityBand, number>;

const zeroTurns = (): Record<FlopRole, TurnTally> =>
  Object.fromEntries(
    FLOP_ROLES.map((role) => [role, { reached: 0, fired: 0, bluffed: 0, checked: 0 }]),
  ) as Record<FlopRole, TurnTally>;

export function stackDepthOf(stackInBigBlinds: number): StackDepth {
  if (stackInBigBlinds < 5) return '<5';
  if (stackInBigBlinds < 10) return '5-10';
  if (stackInBigBlinds <= 20) return '10-20';
  return '>20';
}

export function equityBandOf(equity: number): EquityBand {
  if (equity < 0.2) return '<20';
  if (equity < 0.4) return '20-40';
  if (equity < 0.6) return '40-60';
  if (equity < 0.8) return '60-80';
  return '>80';
}

type Tally = {
  openable: number;
  aggressive: number;
  bluffDriven: number;
  postflopBluffs: number;
  byStreet: Record<Street, StreetTally>;
  bigBets: number;
  bigBetEquity: Record<EquityBand, number>;
  bigBetsWithAir: number;
  allIns: number;
  allInsFromShort: number;
  chosenGambles: number;
  upsideAtPush: number;
  shortSpots: number;
  upsideWhenShort: number;
  byDepth: Record<StackDepth, DepthTally>;
  clampedDown: number;
  twoBarrels: number;
  checksHoldingALock: number;
  highestEquityChecked: number;
  foldsItWantedToRaise: number;
  turnAfterFlop: Record<FlopRole, TurnTally>;
};

/**
 * How one Seat has behaved so far in the Hand now in progress. This is the whole
 * of the measurement's memory: enough to recognise a two-barrel story as one
 * story, and nothing more.
 */
type SeatStory = {
  flopRole: FlopRole | null;
  /** Its first turn decision has been classified, so later ones are not. */
  turnCounted: boolean;
  /** Its two-barrel has been counted, so a third barrel is not a second story. */
  barrelCounted: boolean;
};

/**
 * Accumulates behaviour across a run. Fed one decision at a time by the
 * experiment in `measure-balance.ts`, which owns the simulation itself.
 */
export class BehaviourTally {
  private readonly tallies = new Map<PersonalityKey, Tally>(
    PERSONALITY_KEYS.map((key) => [key, freshTally()]),
  );

  /** Per-Hand memory, so a two-barrel story can be recognised as one story. */
  private stories = new Map<number, SeatStory>();

  private decisions = 0;
  private hands = 0;
  private rebuys = 0;
  private flops = 0;
  private liveAtFlop = 0;
  private threeHandedFlops = 0;

  /** Forget the per-Hand memory. Called when a Hand ends, never mid-Hand. */
  startHand(): void {
    this.stories = new Map();
  }

  handComplete(): void {
    this.hands += 1;
  }

  rebuy(): void {
    this.rebuys += 1;
  }

  flopDealt(liveSeats: number): void {
    this.flops += 1;
    this.liveAtFlop += liveSeats;
    if (liveSeats >= 3) this.threeHandedFlops += 1;
  }

  record(
    key: PersonalityKey,
    view: BotView,
    reasons: DecisionReasons,
    action: PlayerAction['type'],
  ): void {
    const t = this.tallies.get(key);
    if (!t) return;
    this.decisions += 1;

    const story = this.storyFor(view.seat);
    const canOpen = view.legalActions.canBet || view.legalActions.canRaise;
    const depth = t.byDepth[stackDepthOf(view.stack / view.bigBlind)];

    // Aggression counts wherever it happens. A Seat too short to make a legal
    // raise still has the right to push, and that push is precisely the decision
    // this feature added — counting only the openable spots hid four all-ins in
    // every five, which is most of what the readout exists to report.
    if (reasons.aggressive) {
      t.aggressive += 1;
      depth.aggressive += 1;
      if (reasons.bluffDriven) {
        t.bluffDriven += 1;
        if (view.street !== 'preflop') t.postflopBluffs += 1;
      }
      if (reasons.clampedDown) t.clampedDown += 1;
      if (reasons.allIn) {
        t.allIns += 1;
        depth.allIns += 1;
        if (view.stack / view.bigBlind < 10) t.allInsFromShort += 1;
      }
      if (reasons.chosenGamble) {
        t.chosenGambles += 1;
        t.upsideAtPush += reasons.upside;
      }
      if ((reasons.sizeFraction ?? 0) >= A_BIG_BET) {
        t.bigBets += 1;
        t.bigBetEquity[equityBandOf(reasons.trueEquity)] += 1;
        if (reasons.trueEquity < AIR) t.bigBetsWithAir += 1;
      }
    }

    // The *rates*, though, are only fair over spots where aggression was on the
    // table. A Seat with no way to bet or raise cannot show any, so counting it
    // in the denominator would report passivity nobody decided on.
    if (!canOpen) return;

    t.openable += 1;
    const street = t.byStreet[view.street];
    street.decisions += 1;
    depth.decisions += 1;

    // Measured on the effective Stack, which is what the push decision reads.
    if (view.effectiveStack / view.bigBlind < 10) {
      t.shortSpots += 1;
      t.upsideWhenShort += reasons.upside;
    }

    if (view.street === 'flop' && story.flopRole !== 'bluffed') {
      // Bluffing the flop is the loudest thing a Seat can have done there, so it
      // outranks a later value raise on the same Street.
      story.flopRole = reasons.aggressive
        ? reasons.bluffDriven
          ? 'bluffed'
          : 'value-bet'
        : (story.flopRole ?? 'checked');
    }

    if (view.street === 'turn' && story.flopRole !== null && !story.turnCounted) {
      // Only the first turn decision, or a Seat that gets raised back would be
      // counted twice and the shares would stop being shares.
      story.turnCounted = true;
      const turn = t.turnAfterFlop[story.flopRole];
      turn.reached += 1;
      if (reasons.aggressive) {
        turn.fired += 1;
        if (reasons.bluffDriven) turn.bluffed += 1;
      } else if (action === 'check') {
        turn.checked += 1;
      }
    }

    if (reasons.aggressive) {
      street.aggressive += 1;
      if (reasons.bluffDriven) street.bluffDriven += 1;
      if (
        view.street === 'turn' &&
        reasons.bluffDriven &&
        story.flopRole === 'bluffed' &&
        !story.barrelCounted
      ) {
        story.barrelCounted = true;
        t.twoBarrels += 1;
      }
      return;
    }

    if (action === 'check') {
      t.highestEquityChecked = Math.max(t.highestEquityChecked, reasons.trueEquity);
      if (reasons.trueEquity > A_NEAR_CERTAIN_WINNER) t.checksHoldingALock += 1;
    }
    if (action === 'fold' && reasons.wantsToRaise) t.foldsItWantedToRaise += 1;
  }

  report(sessions: number): BehaviourReport {
    const perPersonality = PERSONALITY_KEYS.map((key) => {
      const t = this.tallies.get(key)!;
      return {
        key,
        openable: t.openable,
        aggressive: t.aggressive,
        bluffDriven: t.bluffDriven,
        bluffShare: ratio(t.bluffDriven, t.aggressive),
        postflopBluffsPerSession: t.postflopBluffs / sessions,
        byStreet: t.byStreet,
        aggressionByStreet: Object.fromEntries(
          STREETS.map((street) => [
            street,
            ratio(t.byStreet[street].aggressive, t.byStreet[street].decisions),
          ]),
        ) as Record<Street, number>,
        bigBets: t.bigBets,
        bigBetEquity: t.bigBetEquity,
        bigBetsWithAirPerSession: t.bigBetsWithAir / sessions,
        allIns: t.allIns,
        allInsPerSession: t.allIns / sessions,
        chosenGambles: t.chosenGambles,
        upsideAtPush: ratio(t.upsideAtPush, t.chosenGambles),
        upsideWhenShort: ratio(t.upsideWhenShort, t.shortSpots),
        byDepth: t.byDepth,
        allInsFromShort: ratio(t.allInsFromShort, t.allIns),
        clampedDownShare: ratio(t.clampedDown, t.aggressive),
        twoBarrelsPerSession: t.twoBarrels / sessions,
        checksHoldingALock: t.checksHoldingALock,
        highestEquityChecked: t.highestEquityChecked,
        foldsItWantedToRaise: t.foldsItWantedToRaise,
        turnAfterFlop: t.turnAfterFlop,
      } satisfies PersonalityBehaviour;
    });

    const sum = (pick: (b: PersonalityBehaviour) => number): number =>
      perPersonality.reduce((total, b) => total + pick(b), 0);
    const spreadOf = (pick: (b: PersonalityBehaviour) => number): number =>
      Math.max(...perPersonality.map(pick)) - Math.min(...perPersonality.map(pick));

    const totals = [...this.tallies.values()];
    const aggressive = totals.reduce((n, t) => n + t.aggressive, 0);

    return {
      sessions,
      hands: this.hands,
      decisions: this.decisions,
      perPersonality,
      meanLiveSeatsAtFlop: ratio(this.liveAtFlop, this.flops),
      threeHandedFlopShare: ratio(this.threeHandedFlops, this.flops),
      rebuysPer100Hands: ratio(this.rebuys * 100, this.hands),
      bluffShare: ratio(
        totals.reduce((n, t) => n + t.bluffDriven, 0),
        aggressive,
      ),
      allInsPerSession: sum((b) => b.allInsPerSession),
      allInsFromShort: ratio(
        totals.reduce((n, t) => n + t.allInsFromShort, 0),
        totals.reduce((n, t) => n + t.allIns, 0),
      ),
      clampedDownShare: ratio(
        totals.reduce((n, t) => n + t.clampedDown, 0),
        aggressive,
      ),
      bigBetsWithAirPerSession: sum((b) => b.bigBetsWithAirPerSession),
      twoBarrelsPerSession: sum((b) => b.twoBarrelsPerSession),
      checksHoldingALock: sum((b) => b.checksHoldingALock),
      spread: {
        bluffShare: spreadOf((b) => b.bluffShare),
        allInsPerSession: spreadOf((b) => b.allInsPerSession),
      },
    };
  }

  private storyFor(seat: number): SeatStory {
    let story = this.stories.get(seat);
    if (!story) {
      story = { flopRole: null, turnCounted: false, barrelCounted: false };
      this.stories.set(seat, story);
    }
    return story;
  }
}

const ratio = (numerator: number, denominator: number): number =>
  denominator === 0 ? 0 : numerator / denominator;

function freshTally(): Tally {
  return {
    openable: 0,
    aggressive: 0,
    bluffDriven: 0,
    postflopBluffs: 0,
    byStreet: zeroStreets(),
    bigBets: 0,
    bigBetEquity: zeroBands(),
    bigBetsWithAir: 0,
    allIns: 0,
    allInsFromShort: 0,
    chosenGambles: 0,
    upsideAtPush: 0,
    shortSpots: 0,
    upsideWhenShort: 0,
    byDepth: zeroDepths(),
    clampedDown: 0,
    twoBarrels: 0,
    checksHoldingALock: 0,
    highestEquityChecked: 0,
    foldsItWantedToRaise: 0,
    turnAfterFlop: zeroTurns(),
  };
}
