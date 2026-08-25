// Turning the engine's structured events into the running commentary beside the
// table. This is the only place they become words; the engine emits shapes.
//
// The commentary matters more than it looks: almost everything you can read
// about an opponent in Hold'em lives in the sequence of what they did, and if
// five Bots act in one frame you see none of it.
//
// `describeEvent` takes the locale as an argument, so the log is re-rendered
// from the stored events every time the language changes rather than freezing
// whatever words were current when the Hand was played (ADR-0008).

import type { Card } from '../../poker-math/cards.ts';
import type { GameEvent } from '../../engine/types.ts';
import { RANK_NAMES, describeHand } from './hand-description.ts';
import { streetName, potName, suitSymbol } from './labels.ts';
import type { Locale } from './locale.ts';

export type LogTone = 'system' | 'action' | 'deal' | 'result';

export type LogLine = {
  readonly id: string;
  readonly tone: LogTone;
  readonly text: string;
};

/** How a Seat is referred to: "你"/"You" for the Player, otherwise its Bot's name. */
export type SeatNamer = (seat: number) => string;

export const cardText = (card: Card): string => {
  const rank = RANK_NAMES[card >> 2] ?? '?';
  return `${rank}${suitSymbol[card & 3] ?? ''}`;
};

const cardsText = (cards: readonly Card[]): string => cards.map(cardText).join(' ');

/**
 * `you` marks the Player as the subject of the line.
 *
 * Chinese ignores it — 「你 弃牌」and「Ivey 弃牌」take the same verb. English does
 * not: the Player is addressed in the second person, so the line has to read
 * "You fold" rather than "You folds". CONTEXT.md rules out dodging this by
 * calling the Player "Hero", which is what a poker client would normally do.
 */
type Phrases = {
  readonly joinNames: (names: readonly string[]) => string;
  /** How the "(all-in)" marker attaches to a line that already reads as a sentence. */
  readonly markAllIn: (text: string) => string;
  readonly handStarted: (handNumber: number, orbit: number) => string;
  readonly blindPosted: (who: string, you: boolean, blind: 'small' | 'big', amount: number) => string;
  readonly holeCardsDealt: string;
  readonly fold: (who: string, you: boolean) => string;
  readonly check: (who: string, you: boolean) => string;
  readonly call: (who: string, you: boolean, paid: number) => string;
  readonly bet: (who: string, you: boolean, total: number) => string;
  readonly raise: (who: string, you: boolean, total: number) => string;
  readonly allIn: (who: string, you: boolean, total: number) => string;
  readonly streetDealt: (street: string, cards: string) => string;
  readonly uncalledReturned: (who: string, you: boolean, amount: number) => string;
  readonly allInRunout: (names: string) => string;
  readonly showdown: (names: string) => string;
  readonly potAwarded: (pot: string, amount: number, winners: string, odd: string) => string;
  readonly winner: (who: string, amount: number, hand: string | null) => string;
  readonly oddChip: (who: string) => string;
  readonly rebuy: (who: string, you: boolean, amount: number) => string;
};

/** "You fold" but "Ivey folds". English only; the flag is inert in Chinese. */
const verb = (you: boolean, base: string): string => (you ? base : `${base}s`);

const PHRASES: Record<Locale, Phrases> = {
  zh: {
    joinNames: (names) => names.join('、'),
    markAllIn: (text) => `${text}(all-in)`,
    handStarted: (handNumber, orbit) => `— 第 ${handNumber} 手 · 第 ${orbit} 圈 —`,
    blindPosted: (who, _you, blind, amount) =>
      `${who} 下${blind === 'small' ? '小盲' : '大盲'} ${amount}`,
    holeCardsDealt: '发底牌',
    fold: (who) => `${who} 弃牌`,
    check: (who) => `${who} 过牌`,
    call: (who, _you, paid) => `${who} 跟注 ${paid}`,
    bet: (who, _you, total) => `${who} 下注 ${total}`,
    raise: (who, _you, total) => `${who} 加注到 ${total}`,
    allIn: (who, _you, total) => `${who} all-in ${total}`,
    streetDealt: (street, cards) => `${street} ${cards}`,
    uncalledReturned: (who, _you, amount) => `${who} 收回无人跟注的 ${amount}`,
    allInRunout: (names) => `${names} 全部 all-in,亮牌发完剩余公共牌`,
    showdown: (names) => `摊牌:${names}`,
    potAwarded: (pot, amount, winners, odd) => `${pot} ${amount} → ${winners}${odd}`,
    winner: (who, amount, hand) => `${who} ${amount}${hand === null ? '' : `(${hand})`}`,
    oddChip: (who) => `,余数归 ${who}`,
    rebuy: (who, _you, amount) => `${who} 补码 ${amount}`,
  },
  en: {
    joinNames: (names) => names.join(', '),
    markAllIn: (text) => `${text} (all-in)`,
    handStarted: (handNumber, orbit) => `— Hand ${handNumber} · Orbit ${orbit} —`,
    blindPosted: (who, you, blind, amount) =>
      `${who} ${verb(you, 'post')} the ${blind === 'small' ? 'small' : 'big'} blind ${amount}`,
    holeCardsDealt: 'Hole cards dealt',
    fold: (who, you) => `${who} ${verb(you, 'fold')}`,
    check: (who, you) => `${who} ${verb(you, 'check')}`,
    call: (who, you, paid) => `${who} ${verb(you, 'call')} ${paid}`,
    bet: (who, you, total) => `${who} ${verb(you, 'bet')} ${total}`,
    raise: (who, you, total) => `${who} ${verb(you, 'raise')} to ${total}`,
    allIn: (who, you, total) => `${who} ${you ? 'are' : 'is'} all-in for ${total}`,
    streetDealt: (street, cards) => `${street} ${cards}`,
    uncalledReturned: (who, you, amount) =>
      `${who} ${verb(you, 'take')} back the uncalled ${amount}`,
    allInRunout: (names) => `${names} are all all-in — cards face up for the run-out`,
    showdown: (names) => `Showdown: ${names}`,
    potAwarded: (pot, amount, winners, odd) => `${pot} ${amount} → ${winners}${odd}`,
    winner: (who, amount, hand) => `${who} ${amount}${hand === null ? '' : ` (${hand})`}`,
    oddChip: (who) => `, odd chip to ${who}`,
    rebuy: (who, you, amount) => `${who} ${verb(you, 'rebuy')} ${amount}`,
  },
};

/**
 * One line of commentary, or null for events with nothing to say (the ones that
 * only drive animation or screen changes).
 */
export function describeEvent(
  event: GameEvent,
  nameOf: SeatNamer,
  locale: Locale,
  playerSeat: number,
): Omit<LogLine, 'id'> | null {
  const say = PHRASES[locale];
  const isYou = (seat: number) => seat === playerSeat;

  switch (event.type) {
    case 'hand-started':
      return { tone: 'system', text: say.handStarted(event.handNumber, event.orbit) };

    case 'blind-posted': {
      const text = say.blindPosted(
        nameOf(event.seat),
        isYou(event.seat),
        event.blind,
        event.amount,
      );
      return { tone: 'action', text: event.allIn ? say.markAllIn(text) : text };
    }

    case 'hole-cards-dealt':
      return { tone: 'deal', text: say.holeCardsDealt };

    case 'acted': {
      const who = nameOf(event.seat);
      const you = isYou(event.seat);
      const mark = (text: string) => (event.allIn ? say.markAllIn(text) : text);
      switch (event.action) {
        case 'fold':
          return { tone: 'action', text: say.fold(who, you) };
        case 'check':
          return { tone: 'action', text: say.check(who, you) };
        case 'call':
          return { tone: 'action', text: mark(say.call(who, you, event.paid)) };
        case 'bet':
          return { tone: 'action', text: mark(say.bet(who, you, event.totalThisStreet)) };
        case 'raise':
          return { tone: 'action', text: mark(say.raise(who, you, event.totalThisStreet)) };
        case 'all-in':
          return { tone: 'action', text: say.allIn(who, you, event.totalThisStreet) };
      }
      return null;
    }

    case 'street-dealt':
      return {
        tone: 'deal',
        text: say.streetDealt(streetName(event.street, locale), cardsText(event.cards)),
      };

    case 'uncalled-returned':
      return {
        tone: 'system',
        text: say.uncalledReturned(nameOf(event.seat), isYou(event.seat), event.amount),
      };

    case 'all-in-runout':
      return { tone: 'system', text: say.allInRunout(say.joinNames(event.seats.map(nameOf))) };

    case 'showdown':
      return { tone: 'system', text: say.showdown(say.joinNames(event.seats.map(nameOf))) };

    case 'pot-awarded': {
      const winners = say.joinNames(
        event.winners.map((winner) =>
          say.winner(
            nameOf(winner.seat),
            winner.amount,
            winner.handValue === null ? null : describeHand(winner.handValue, locale),
          ),
        ),
      );
      const odd = event.oddChipSeat === null ? '' : say.oddChip(nameOf(event.oddChipSeat));
      return {
        tone: 'result',
        text: say.potAwarded(potName(event.potIndex, locale), event.amount, winners, odd),
      };
    }

    case 'rebuy':
      return {
        tone: 'system',
        text: say.rebuy(nameOf(event.seat), isYou(event.seat), event.amount),
      };

    case 'hand-complete':
    case 'session-complete':
      return null;
  }
}
