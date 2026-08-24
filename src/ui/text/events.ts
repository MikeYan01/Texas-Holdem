// Turning the engine's structured events into the running commentary beside the
// table. This is the only place they become words; the engine emits shapes.
//
// The commentary matters more than it looks: almost everything you can read
// about an opponent in Hold'em lives in the sequence of what they did, and if
// five Bots act in one frame you see none of it.

import { formatCard } from '../../poker-math/cards.ts';
import type { Card } from '../../poker-math/cards.ts';
import type { GameEvent } from '../../engine/types.ts';
import { describeHand } from './hand-description.ts';
import { RANK_NAMES } from './hand-description.ts';
import { STREET_NAMES, potName, suitSymbol } from './labels.ts';

export type LogTone = 'system' | 'action' | 'deal' | 'result';

export type LogLine = {
  readonly id: string;
  readonly tone: LogTone;
  readonly text: string;
};

/** How a Seat is referred to: "你" for the Player, otherwise its Bot's name. */
export type SeatNamer = (seat: number) => string;

export const cardText = (card: Card): string => {
  const rank = RANK_NAMES[card >> 2] ?? '?';
  return `${rank}${suitSymbol[card & 3] ?? ''}`;
};

const cardsText = (cards: readonly Card[]): string => cards.map(cardText).join(' ');

/**
 * One line of commentary, or null for events with nothing to say (the ones that
 * only drive animation or screen changes).
 */
export function describeEvent(event: GameEvent, nameOf: SeatNamer): Omit<LogLine, 'id'> | null {
  switch (event.type) {
    case 'hand-started':
      return { tone: 'system', text: `— 第 ${event.handNumber} 手 · 第 ${event.orbit} 圈 —` };

    case 'blind-posted':
      return {
        tone: 'action',
        text: `${nameOf(event.seat)} 下${event.blind === 'small' ? '小盲' : '大盲'} ${event.amount}${
          event.allIn ? '(all-in)' : ''
        }`,
      };

    case 'hole-cards-dealt':
      return { tone: 'deal', text: '发底牌' };

    case 'acted': {
      const who = nameOf(event.seat);
      const allIn = event.allIn ? '(all-in)' : '';
      switch (event.action) {
        case 'fold':
          return { tone: 'action', text: `${who} 弃牌` };
        case 'check':
          return { tone: 'action', text: `${who} 过牌` };
        case 'call':
          return { tone: 'action', text: `${who} 跟注 ${event.paid}${allIn}` };
        case 'bet':
          return { tone: 'action', text: `${who} 下注 ${event.totalThisStreet}${allIn}` };
        case 'raise':
          return { tone: 'action', text: `${who} 加注到 ${event.totalThisStreet}${allIn}` };
        case 'all-in':
          return { tone: 'action', text: `${who} all-in ${event.totalThisStreet}` };
      }
      return null;
    }

    case 'street-dealt':
      return { tone: 'deal', text: `${STREET_NAMES[event.street]} ${cardsText(event.cards)}` };

    case 'uncalled-returned':
      return { tone: 'system', text: `${nameOf(event.seat)} 收回无人跟注的 ${event.amount}` };

    case 'all-in-runout':
      return {
        tone: 'system',
        text: `${event.seats.map(nameOf).join('、')} 全部 all-in,亮牌发完剩余公共牌`,
      };

    case 'showdown':
      return { tone: 'system', text: `摊牌:${event.seats.map(nameOf).join('、')}` };

    case 'pot-awarded': {
      const pot = potName(event.potIndex);
      const winners = event.winners
        .map((winner) => {
          const hand = winner.handValue === null ? '' : `(${describeHand(winner.handValue)})`;
          return `${nameOf(winner.seat)} ${winner.amount}${hand}`;
        })
        .join('、');
      const odd =
        event.oddChipSeat === null ? '' : `,余数归 ${nameOf(event.oddChipSeat)}`;
      return { tone: 'result', text: `${pot} ${event.amount} → ${winners}${odd}` };
    }

    case 'rebuy':
      return { tone: 'system', text: `${nameOf(event.seat)} 补码 ${event.amount}` };

    case 'hand-complete':
    case 'session-complete':
      return null;
  }
}

/** The card text used on the felt, e.g. `A♠`. Exported for the card component. */
export const formatCardForEngine = formatCard;
