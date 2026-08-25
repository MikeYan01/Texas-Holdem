import { describe, expect, it } from 'vitest';
import { parseCards } from '../../poker-math/cards.ts';
import { HandCategory, categoryOf, evaluateHand } from '../../poker-math/evaluate-hand.ts';
import { LOCALES, type Locale } from './locale.ts';
import { CATEGORY_NAMES, describeCategory, describeHand } from './hand-description.ts';

const said = (cards: string, locale: Locale) =>
  describeHand(evaluateHand(parseCards(cards)), locale);
const say = (cards: string) => said(cards, 'zh');
const sayEn = (cards: string) => said(cards, 'en');

describe('describeHand', () => {
  it('names all nine categories, in every language', () => {
    const byCategory: Array<[string, HandCategory]> = [
      ['2h 3d 5s 7c 9h Jd Ks', HandCategory.HighCard],
      ['2h 2d 5s 7c 9h Jd Ks', HandCategory.Pair],
      ['2h 2d 5s 5c 9h Jd Ks', HandCategory.TwoPair],
      ['2h 2d 2s 5c 9h Jd Ks', HandCategory.Trips],
      ['2h 3d 4s 5c 6h Jd Ks', HandCategory.Straight],
      ['2h 5h 7h 9h Jh 3d Ks', HandCategory.Flush],
      ['2h 2d 2s 5c 5h Jd Ks', HandCategory.FullHouse],
      ['2h 2d 2s 2c 5h Jd Ks', HandCategory.Quads],
      ['2h 3h 4h 5h 6h Jd Ks', HandCategory.StraightFlush],
    ];
    for (const locale of LOCALES) {
      for (const [cards, category] of byCategory) {
        const value = evaluateHand(parseCards(cards));
        expect(categoryOf(value)).toBe(category);
        expect(describeCategory(value, locale)).toBe(CATEGORY_NAMES[locale][category]);
        expect(describeHand(value, locale)).toContain(
          CATEGORY_NAMES[locale][category].slice(0, 1),
        );
      }
    }
  });

  it('gives every category a distinct name in every language', () => {
    for (const locale of LOCALES) {
      const names = Object.values(CATEGORY_NAMES[locale]);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('says the exact phrases the ticket asks for', () => {
    expect(say('Ah Ad Ks Kc Qh 7d 2s')).toBe('两对,A 和 K,踢脚 Q');
    expect(say('Th Jd Qs Kc Ah 7d 2s')).toBe('顺子,10 到 A');
    expect(say('Kh 9h 7h 4h 2h 8d 3s')).toBe('同花,K 高');
  });

  it('names the key card and the kickers for each category', () => {
    expect(say('Ah Kd Qs Jc 9h 7d 2s')).toBe('高牌,A 高');
    expect(say('Ah Ad Ks Qc 9h 7d 2s')).toBe('一对 A,踢脚 K Q 9');
    expect(say('9h 9d 9s Kc Qh 7d 2s')).toBe('三条 9,踢脚 K Q');
    expect(say('9h 9d 9s Kc Kh 7d 2s')).toBe('葫芦,9 带 K');
    expect(say('9h 9d 9s 9c Kh 7d 2s')).toBe('四条 9,踢脚 K');
  });

  it('reads the wheel from the ace end, where the ace is playing low', () => {
    expect(say('Ah 2d 3s 4c 5h Kd Qs')).toBe('顺子,A 到 5');
    expect(say('Ah 2h 3h 4h 5h Kd Qs')).toBe('同花顺,A 到 5');
    expect(sayEn('Ah 2d 3s 4c 5h Kd Qs')).toBe('Straight, A to 5');
    expect(sayEn('Ah 2h 3h 4h 5h Kd Qs')).toBe('Straight flush, A to 5');
  });

  it('gives the top straight flush its own name', () => {
    expect(say('Th Jh Qh Kh Ah 7d 2s')).toBe('皇家同花顺');
    expect(say('9h Th Jh Qh Kh 7d 2s')).toBe('同花顺,9 到 K');
    expect(sayEn('Th Jh Qh Kh Ah 7d 2s')).toBe('Royal flush');
    expect(sayEn('9h Th Jh Qh Kh 7d 2s')).toBe('Straight flush, 9 to K');
  });

  it('writes ten as 10 in both languages, because nobody says T', () => {
    expect(say('Th Td 5s 7c 9h Jd Ks')).toBe('一对 10,踢脚 K J 9');
    expect(say('6h 7d 8s 9c Th 2d 3s')).toBe('顺子,6 到 10');
    expect(sayEn('6h 7d 8s 9c Th 2d 3s')).toBe('Straight, 6 to 10');
  });

  it('names the third pair as the two-pair kicker when that is what it is', () => {
    // Three pairs on board and in hand: the queens are the kicker, not the deuce.
    expect(say('Ah Ad Ks Kc Qh Qd 2s')).toBe('两对,A 和 K,踢脚 Q');
    expect(sayEn('Ah Ad Ks Kc Qh Qd 2s')).toBe('Two pair, aces and kings, kicker Q');
  });

  it('says the English the way a table says it, plurals and all', () => {
    expect(sayEn('Ah Kd Qs Jc 9h 7d 2s')).toBe('High card, A high');
    expect(sayEn('Ah Ad Ks Qc 9h 7d 2s')).toBe('Pair of aces, kickers K Q 9');
    expect(sayEn('Th Td 5s 7c 9h Jd Ks')).toBe('Pair of tens, kickers K J 9');
    expect(sayEn('Ah Ad Ks Kc Qh 7d 2s')).toBe('Two pair, aces and kings, kicker Q');
    expect(sayEn('9h 9d 9s Kc Qh 7d 2s')).toBe('Three of a kind, nines, kickers K Q');
    expect(sayEn('Th Jd Qs Kc Ah 7d 2s')).toBe('Straight, 10 to A');
    expect(sayEn('Kh 9h 7h 4h 2h 8d 3s')).toBe('Flush, K high');
    expect(sayEn('9h 9d 9s Kc Kh 7d 2s')).toBe('Full house, nines full of kings');
    expect(sayEn('9h 9d 9s 9c Kh 7d 2s')).toBe('Four of a kind, nines, kicker K');
  });

  it('is defined for every hand that can be made, in every language', () => {
    const deck = Array.from({ length: 52 }, (_, i) => i);
    const hand = new Int32Array(7);
    // A broad sweep rather than an exhaustive one: enough to be sure no category
    // or rank combination falls through to a "?" or an empty kicker list.
    const danglingKicker = { zh: /踢脚\s*$/, en: /kickers?\s*$/ } as const;
    for (let a = 0; a < 46; a++) {
      for (let b = a + 1; b < 52; b += 3) {
        for (let c = b + 1; c < 52; c += 5) {
          hand[0] = deck[a]!;
          hand[1] = deck[b]!;
          hand[2] = deck[c]!;
          hand[3] = deck[(a + 7) % 52]!;
          hand[4] = deck[(b + 13) % 52]!;
          hand[5] = deck[(c + 23) % 52]!;
          hand[6] = deck[(a + 31) % 52]!;
          if (new Set(hand).size !== 7) continue;
          const value = evaluateHand(hand);
          for (const locale of LOCALES) {
            const text = describeHand(value, locale);
            expect(text).not.toContain('?');
            expect(text).not.toContain('undefined');
            expect(text).not.toMatch(danglingKicker[locale]);
          }
        }
      }
    }
  });
});
