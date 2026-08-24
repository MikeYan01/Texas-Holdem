import { describe, expect, it } from 'vitest';
import { parseCards } from '../../poker-math/cards.ts';
import { evaluateHand } from '../../poker-math/evaluate-hand.ts';
import { createSession, reduce } from '../../engine/engine.ts';
import type { GameEvent, SessionState } from '../../engine/types.ts';
import { cardText, describeEvent } from './events.ts';

const nameOf = (seat: number) => (seat === 0 ? '你' : `岩石${seat}`);
const say = (event: GameEvent) => describeEvent(event, nameOf)?.text ?? null;

describe('cardText', () => {
  it('writes a card the way the felt shows it', () => {
    const [ace, ten, deuce] = parseCards('Ah Td 2c');
    expect(cardText(ace!)).toBe('A♥');
    expect(cardText(ten!)).toBe('10♦');
    expect(cardText(deuce!)).toBe('2♣');
  });
});

describe('describeEvent', () => {
  it('announces the Hand and the Orbit', () => {
    expect(say({ type: 'hand-started', handNumber: 7, orbit: 2, buttonSeat: 1 })).toBe(
      '— 第 7 手 · 第 2 圈 —',
    );
  });

  it('names the blinds', () => {
    expect(say({ type: 'blind-posted', seat: 1, amount: 1, blind: 'small', allIn: false })).toBe(
      '岩石1 下小盲 1',
    );
    expect(say({ type: 'blind-posted', seat: 2, amount: 2, blind: 'big', allIn: false })).toBe(
      '岩石2 下大盲 2',
    );
  });

  it('writes each action the way the ticket asks for it', () => {
    const acted = (action: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in', extra = {}) =>
      say({
        type: 'acted',
        seat: 3,
        action,
        paid: 10,
        totalThisStreet: 12,
        allIn: false,
        ...extra,
      } as GameEvent);

    expect(acted('fold')).toBe('岩石3 弃牌');
    expect(acted('check')).toBe('岩石3 过牌');
    expect(acted('call')).toBe('岩石3 跟注 10');
    expect(acted('bet')).toBe('岩石3 下注 12');
    expect(acted('raise')).toBe('岩石3 加注到 12');
    expect(acted('all-in')).toBe('岩石3 all-in 12');
  });

  it('marks an action that put the Seat all-in', () => {
    expect(
      say({ type: 'acted', seat: 3, action: 'call', paid: 10, totalThisStreet: 12, allIn: true }),
    ).toBe('岩石3 跟注 10(all-in)');
  });

  it('calls the Player 你', () => {
    expect(say({ type: 'acted', seat: 0, action: 'fold', paid: 0, totalThisStreet: 0, allIn: false })).toBe(
      '你 弃牌',
    );
  });

  it('names the Street and its cards', () => {
    expect(say({ type: 'street-dealt', street: 'flop', cards: parseCards('Ah Td 2c') })).toBe(
      '翻牌 A♥ 10♦ 2♣',
    );
    expect(say({ type: 'street-dealt', street: 'river', cards: parseCards('7s') })).toBe('河牌 7♠');
  });

  it('says where an uncalled bet went', () => {
    expect(say({ type: 'uncalled-returned', seat: 2, amount: 40 })).toBe('岩石2 收回无人跟注的 40');
  });

  it('reports each pot and the hand that won it', () => {
    const twoPair = evaluateHand(parseCards('Ah Ad Ks Kc Qh 7d 2s'));
    expect(
      say({
        type: 'pot-awarded',
        potIndex: 0,
        amount: 120,
        winners: [{ seat: 1, amount: 120, handValue: twoPair, bestFive: null }],
        oddChipSeat: null,
      }),
    ).toBe('主池 120 → 岩石1 120(两对,A 带 K,踢脚 Q)');
  });

  it('names side pots separately', () => {
    expect(
      say({
        type: 'pot-awarded',
        potIndex: 1,
        amount: 60,
        winners: [{ seat: 2, amount: 60, handValue: null, bestFive: null }],
        oddChipSeat: null,
      }),
    ).toBe('边池 1 60 → 岩石2 60');
  });

  it('says who took the remainder of a split', () => {
    expect(
      say({
        type: 'pot-awarded',
        potIndex: 0,
        amount: 51,
        winners: [
          { seat: 1, amount: 26, handValue: null, bestFive: null },
          { seat: 2, amount: 25, handValue: null, bestFive: null },
        ],
        oddChipSeat: 1,
      }),
    ).toBe('主池 51 → 岩石1 26、岩石2 25,余数归 岩石1');
  });

  it('says nothing for events that only drive the screen', () => {
    expect(say({ type: 'hand-complete', handNumber: 3 })).toBeNull();
    expect(say({ type: 'session-complete' })).toBeNull();
  });

  it('has something to say for every event a real Session produces', () => {
    const seen = new Set<string>();
    let state: SessionState = createSession({ seed: 4242 });
    for (let step = 0; step < 40_000 && state.phase !== 'session-complete'; step++) {
      state =
        state.phase === 'awaiting-action'
          ? reduce(state, state.legalActions!.canCheck ? { type: 'check' } : { type: 'call' })
          : reduce(state, { type: 'advance' });
      for (const event of state.events) {
        seen.add(event.type);
        const line = describeEvent(event, nameOf);
        if (event.type === 'hand-complete' || event.type === 'session-complete') {
          expect(line).toBeNull();
        } else {
          expect(line, event.type).not.toBeNull();
          expect(line!.text).not.toContain('undefined');
          expect(line!.text).not.toContain('NaN');
        }
      }
    }
    // The sweep is only worth anything if it actually met the interesting events.
    for (const type of ['hand-started', 'blind-posted', 'acted', 'street-dealt', 'pot-awarded']) {
      expect(seen).toContain(type);
    }
  });
});
