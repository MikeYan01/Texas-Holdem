import { describe, expect, it } from 'vitest';
import { parseCards } from '../../poker-math/cards.ts';
import { evaluateHand } from '../../poker-math/evaluate-hand.ts';
import { createSession, reduce } from '../../engine/engine.ts';
import type { GameEvent, SessionState } from '../../engine/types.ts';
import { cardText, describeEvent } from './events.ts';
import { LOCALES } from './locale.ts';

const nameOf = (seat: number) => (seat === 0 ? '你' : `岩石${seat}`);
const nameOfEn = (seat: number) => (seat === 0 ? 'You' : `Rock${seat}`);
const PLAYER_SEAT = 0;
const say = (event: GameEvent) => describeEvent(event, nameOf, 'zh', PLAYER_SEAT)?.text ?? null;
const sayEn = (event: GameEvent) =>
  describeEvent(event, nameOfEn, 'en', PLAYER_SEAT)?.text ?? null;

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
        eligibleSeats: [1, 2],
        winners: [{ seat: 1, amount: 120, handValue: twoPair, bestFive: null }],
        oddChipSeat: null,
      }),
    ).toBe('主池 120 → 岩石1 120(两对,A 和 K,踢脚 Q)');
  });

  it('names side pots separately', () => {
    expect(
      say({
        type: 'pot-awarded',
        potIndex: 1,
        amount: 60,
        eligibleSeats: [2, 3],
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
        eligibleSeats: [1, 2],
        winners: [
          { seat: 1, amount: 26, handValue: null, bestFive: null },
          { seat: 2, amount: 25, handValue: null, bestFive: null },
        ],
        oddChipSeat: 1,
      }),
    ).toBe('主池 51 → 岩石1 26、岩石2 25,余数归 岩石1');
  });

  it('says nothing for events that only drive the screen', () => {
    for (const locale of LOCALES) {
      expect(
        describeEvent({ type: 'hand-complete', handNumber: 3 }, nameOf, locale, PLAYER_SEAT),
      ).toBeNull();
      expect(
        describeEvent({ type: 'session-complete' }, nameOf, locale, PLAYER_SEAT),
      ).toBeNull();
    }
  });

  it('writes the same events in English', () => {
    expect(sayEn({ type: 'hand-started', handNumber: 7, orbit: 2, buttonSeat: 1 })).toBe(
      '— Hand 7 · Orbit 2 —',
    );
    expect(sayEn({ type: 'blind-posted', seat: 1, amount: 2, blind: 'small', allIn: false })).toBe(
      'Rock1 posts the small blind 2',
    );
    expect(sayEn({ type: 'blind-posted', seat: 2, amount: 5, blind: 'big', allIn: true })).toBe(
      'Rock2 posts the big blind 5 (all-in)',
    );

    const acted = (action: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in', allIn = false) =>
      sayEn({
        type: 'acted',
        seat: 3,
        action,
        paid: 10,
        totalThisStreet: 12,
        allIn,
      } as GameEvent);

    expect(acted('fold')).toBe('Rock3 folds');
    expect(acted('check')).toBe('Rock3 checks');
    expect(acted('call')).toBe('Rock3 calls 10');
    expect(acted('bet')).toBe('Rock3 bets 12');
    expect(acted('raise')).toBe('Rock3 raises to 12');
    expect(acted('all-in')).toBe('Rock3 is all-in for 12');
    expect(acted('call', true)).toBe('Rock3 calls 10 (all-in)');

    expect(sayEn({ type: 'street-dealt', street: 'flop', cards: parseCards('Ah Td 2c') })).toBe(
      'Flop A♥ 10♦ 2♣',
    );
    expect(sayEn({ type: 'uncalled-returned', seat: 2, amount: 40 })).toBe(
      'Rock2 takes back the uncalled 40',
    );
    expect(sayEn({ type: 'rebuy', seat: 2, amount: 100 })).toBe('Rock2 rebuys 100');
    expect(sayEn({ type: 'showdown', seats: [1, 2] })).toBe('Showdown: Rock1, Rock2');
  });

  it('addresses the Player in the second person, and the Bots in the third', () => {
    const acted = (seat: number, action: 'fold' | 'call' | 'raise' | 'all-in') =>
      sayEn({ type: 'acted', seat, action, paid: 10, totalThisStreet: 12, allIn: false } as GameEvent);

    // "You folds" is the trap this test exists to catch.
    expect(acted(PLAYER_SEAT, 'fold')).toBe('You fold');
    expect(acted(PLAYER_SEAT, 'call')).toBe('You call 10');
    expect(acted(PLAYER_SEAT, 'raise')).toBe('You raise to 12');
    expect(acted(PLAYER_SEAT, 'all-in')).toBe('You are all-in for 12');
    expect(acted(3, 'fold')).toBe('Rock3 folds');
    expect(acted(3, 'all-in')).toBe('Rock3 is all-in for 12');

    expect(sayEn({ type: 'blind-posted', seat: 0, amount: 2, blind: 'small', allIn: false })).toBe(
      'You post the small blind 2',
    );
    expect(sayEn({ type: 'uncalled-returned', seat: 0, amount: 40 })).toBe(
      'You take back the uncalled 40',
    );
    expect(sayEn({ type: 'rebuy', seat: 0, amount: 100 })).toBe('You rebuy 100');

    // Chinese takes the same verb either way, so nothing changes there.
    expect(say({ type: 'acted', seat: 0, action: 'fold', paid: 0, totalThisStreet: 0, allIn: false })).toBe(
      '你 弃牌',
    );
  });

  it('reports pots and the hand that won them in English', () => {
    const twoPair = evaluateHand(parseCards('Ah Ad Ks Kc Qh 7d 2s'));
    expect(
      sayEn({
        type: 'pot-awarded',
        potIndex: 0,
        amount: 120,
        eligibleSeats: [1, 2],
        winners: [{ seat: 1, amount: 120, handValue: twoPair, bestFive: null }],
        oddChipSeat: null,
      }),
    ).toBe('Main pot 120 → Rock1 120 (Two pair, aces and kings, kicker Q)');

    expect(
      sayEn({
        type: 'pot-awarded',
        potIndex: 1,
        amount: 60,
        eligibleSeats: [2, 3],
        winners: [{ seat: 2, amount: 60, handValue: null, bestFive: null }],
        oddChipSeat: null,
      }),
    ).toBe('Side pot 1 60 → Rock2 60');

    expect(
      sayEn({
        type: 'pot-awarded',
        potIndex: 0,
        amount: 51,
        eligibleSeats: [1, 2],
        winners: [
          { seat: 1, amount: 26, handValue: null, bestFive: null },
          { seat: 2, amount: 25, handValue: null, bestFive: null },
        ],
        oddChipSeat: 1,
      }),
    ).toBe('Main pot 51 → Rock1 26, Rock2 25, odd chip to Rock1');
  });

  it('has something to say for every event a real Session produces, in every language', () => {
    const seen = new Set<string>();
    let state: SessionState = createSession({ seed: 4242 });
    for (let step = 0; step < 40_000 && state.phase !== 'session-complete'; step++) {
      state =
        state.phase === 'awaiting-action'
          ? reduce(state, state.legalActions!.canCheck ? { type: 'check' } : { type: 'call' })
          : reduce(state, { type: 'advance' });
      for (const event of state.events) {
        seen.add(event.type);
        for (const locale of LOCALES) {
          const line = describeEvent(event, nameOf, locale, state.playerSeat);
          if (event.type === 'hand-complete' || event.type === 'session-complete') {
            expect(line, locale).toBeNull();
          } else {
            expect(line, `${event.type} in ${locale}`).not.toBeNull();
            expect(line!.text).not.toContain('undefined');
            expect(line!.text).not.toContain('NaN');
            expect(line!.text.trim()).not.toBe('');
          }
        }
      }
    }
    // The sweep is only worth anything if it actually met the interesting events.
    for (const type of ['hand-started', 'blind-posted', 'acted', 'street-dealt', 'pot-awarded']) {
      expect(seen).toContain(type);
    }
  });
});
