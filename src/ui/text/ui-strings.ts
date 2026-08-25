// Every word of interface chrome, in both languages.
//
// One `UiStrings` type and a `Record<Locale, UiStrings>` means a missing
// translation is a type error rather than a blank on screen. Anything that needs
// a number is a function, so the two languages are free to put it in different
// places — English says "6 Hands per Orbit", Chinese says "每圈 6 手".
//
// What is NOT here: the running commentary (`events.ts`), hand names
// (`hand-description.ts`) and the words for Streets and pots (`labels.ts`).
// Those turn engine values into words and take a `Locale` argument directly, so
// they stay testable under bare Node.
//
// `all-in` is left in English in both languages, and the Bots keep their
// surnames, for the reasons in AGENTS.md.

import type { HandCategory } from '../../poker-math/evaluate-hand.ts';
import type { Locale } from './locale.ts';

export type UiStrings = {
  /** Also the browser tab. */
  readonly appTitle: string;

  readonly language: {
    readonly label: string;
  };

  readonly start: {
    readonly lead: (seatCount: number, orbits: number, hands: number) => string;
    readonly begin: string;
  };

  readonly table: {
    readonly handCounter: (hand: number, total: number) => string;
    readonly handCounterNote: string;
    readonly orbitCounter: (orbit: number, total: number) => string;
    readonly orbitCounterNote: (seatCount: number) => string;
    readonly orbitHint: (seatCount: number) => string;
    readonly blinds: (small: number, big: number, startingStack: number) => string;
    readonly emptyPot: string;
    readonly middleTotal: (amount: number) => string;
  };

  readonly seat: {
    readonly stackLabel: string;
    readonly stackNote: string;
    readonly scoreLabel: string;
    readonly scoreNote: string;
    readonly folded: string;
    readonly buttonNote: string;
  };

  readonly actions: {
    readonly waiting: string;
    readonly fold: string;
    readonly check: string;
    readonly call: (amount: number) => string;
    readonly bet: string;
    readonly raiseTo: string;
    readonly halfPot: (amount: number) => string;
    readonly pot: (amount: number) => string;
    readonly allIn: (amount: number) => string;
    readonly sliderLabel: string;
  };

  readonly log: {
    readonly title: string;
    readonly collapse: string;
    readonly collapseNote: string;
    readonly reopen: string;
    readonly reopenNote: string;
  };

  readonly reveal: {
    readonly title: string;
    readonly boardLabel: string;
    /** The Hand ended early, so some community cards were never dealt. */
    readonly boardCutShort: (beforeFlop: boolean) => string;
    readonly eligible: (count: number) => string;
    readonly oddChip: (who: string) => string;
    readonly folded: string;
    readonly next: string;
  };

  readonly odds: {
    readonly title: string;
    readonly preflop: string;
    readonly madeNow: (category: string) => string;
    readonly cardsToCome: (count: number) => string;
    readonly settled: string;
  };

  readonly results: {
    readonly title: string;
    readonly lead: (hands: number) => string;
    readonly rebuys: (count: number) => string;
    readonly restart: string;
  };

  readonly rankings: {
    /** The topbar link. Short — it sits where the Street name used to. */
    readonly open: string;
    readonly openNote: string;
    readonly title: string;
    readonly lead: string;
    readonly close: string;
    /** One line per category, strongest first. */
    readonly notes: Record<HandCategory, string>;
  };
};

const zh: UiStrings = {
  appTitle: '德州扑克',

  language: {
    label: '语言',
  },

  start: {
    lead: (seatCount, orbits, hands) =>
      `${seatCount} 人桌,你对 ${seatCount - 1} 个 Bot。打满 ${orbits} 圈共 ${hands} 手,按净胜负排名。`,
    begin: '开始新局',
  },

  table: {
    handCounter: (hand, total) => `第 ${hand} / ${total} 手`,
    handCounterNote: '一手牌:从下盲注、发底牌,到摊牌或只剩一人、底池分完为止',
    orbitCounter: (orbit, total) => `第 ${orbit} / ${total} 圈`,
    orbitCounterNote: (seatCount) =>
      `一圈:Button 绕桌一周,共 ${seatCount} 手。一圈之内每个座位各当过一次庄位、小盲和大盲`,
    orbitHint: (seatCount) => `每圈 ${seatCount} 手`,
    blinds: (small, big, startingStack) =>
      `盲注 ${small} / ${big} · 起始码量 ${startingStack}`,
    emptyPot: '底池 0',
    middleTotal: (amount) => `总计 ${amount}`,
  },

  seat: {
    stackLabel: '码量',
    stackNote: 'Stack:这手牌面前的筹码',
    scoreLabel: '净胜负',
    scoreNote: 'Score:整局累计净胜负',
    folded: '已弃牌',
    buttonNote: 'Button:庄家位',
  },

  actions: {
    waiting: '等待其他 Seat 行动…',
    fold: '弃牌',
    check: '过牌',
    call: (amount) => `跟注 ${amount}`,
    bet: '下注',
    raiseTo: '加注到',
    halfPot: (amount) => `1/2 池 ${amount}`,
    pot: (amount) => `满池 ${amount}`,
    allIn: (amount) => `All-in ${amount}`,
    sliderLabel: '加注额',
  },

  log: {
    title: '行动记录',
    collapse: '收起 ‹',
    collapseNote: '收起行动记录',
    reopen: '行动记录 ›',
    reopenNote: '展开行动记录',
  },

  reveal: {
    title: '复盘亮牌',
    boardLabel: '公共牌',
    boardCutShort: (beforeFlop) =>
      `这手牌在${beforeFlop ? '翻牌前' : '发完之前'}就结束了,剩下的公共牌没有发出`,
    eligible: (count) => `${count} 人有资格`,
    oddChip: (who) => `余数归 ${who}`,
    folded: '弃牌',
    next: '下一手',
  },

  odds: {
    title: '成牌概率',
    preflop: '翻牌前',
    madeNow: (category) => `当前 ${category}`,
    cardsToCome: (count) => ` · 还有 ${count} 张公共牌`,
    settled: ' · 已定型',
  },

  results: {
    title: '本局结束',
    lead: (hands) => `${hands} 手打完,按净胜负排名。`,
    rebuys: (count) => `补码 ${count} 次`,
    restart: '再来一局',
  },

  rankings: {
    open: '牌型',
    openNote: '各种牌型的大小与例子',
    title: '牌型大小',
    lead: '从你的两张底牌和五张公共牌里,任选五张凑出最大的牌型。下面从大到小。',
    close: '知道了',
    notes: {
      8: '五张同花色的连续牌。10 到 A 这一副叫皇家同花顺,是最大的牌。',
      7: '四张同点数的牌,外加一张闲牌。',
      6: '三张同点加一对。比大小先看三条,再看对子。',
      5: '五张同花色,不必连续。比大小看最大的那张。',
      4: '五张连续的牌,花色不限。A 可以当 1 用,组成 A-2-3-4-5。',
      3: '三张同点数的牌,外加两张闲牌。',
      2: '两个对子,外加一张闲牌。',
      1: '一对同点数的牌,外加三张闲牌。',
      0: '以上都不是。比最大的单张,一样大就往下比。',
    },
  },
};

const en: UiStrings = {
  appTitle: "Texas Hold'em",

  language: {
    label: 'Language',
  },

  start: {
    lead: (seatCount, orbits, hands) =>
      `A ${seatCount}-handed table: you against ${seatCount - 1} Bots. ${orbits} Orbits, ` +
      `${hands} Hands, ranked on Score.`,
    begin: 'New Session',
  },

  table: {
    handCounter: (hand, total) => `Hand ${hand} / ${total}`,
    handCounterNote:
      'Hand: from posting the blinds and dealing hole cards through to showdown, ' +
      'or to everyone but one folding, and the pots being pushed',
    orbitCounter: (orbit, total) => `Orbit ${orbit} / ${total}`,
    orbitCounterNote: (seatCount) =>
      `Orbit: one lap of the Button, ${seatCount} Hands. Within an Orbit every Seat has been ` +
      'the Button, the small blind and the big blind exactly once',
    orbitHint: (seatCount) => `${seatCount} Hands per Orbit`,
    blinds: (small, big, startingStack) =>
      `Blinds ${small} / ${big} · Starting Stack ${startingStack}`,
    emptyPot: 'Pot 0',
    middleTotal: (amount) => `Total ${amount}`,
  },

  seat: {
    stackLabel: 'Stack',
    stackNote: 'Stack: the chips in front of this Seat for the current Hand',
    scoreLabel: 'Score',
    scoreNote: 'Score: net win/loss across the whole Session',
    folded: 'folded',
    buttonNote: 'Button: the nominal dealer',
  },

  actions: {
    waiting: 'Waiting for the other Seats…',
    fold: 'Fold',
    check: 'Check',
    call: (amount) => `Call ${amount}`,
    bet: 'Bet',
    raiseTo: 'Raise to',
    halfPot: (amount) => `1/2 pot ${amount}`,
    pot: (amount) => `Pot ${amount}`,
    allIn: (amount) => `All-in ${amount}`,
    sliderLabel: 'Raise amount',
  },

  log: {
    title: 'Action log',
    collapse: 'Hide ‹',
    collapseNote: 'Hide the action log',
    reopen: 'Action log ›',
    reopenNote: 'Show the action log',
  },

  reveal: {
    title: 'Reveal',
    boardLabel: 'Board',
    boardCutShort: (beforeFlop) =>
      beforeFlop
        ? 'This Hand ended before the flop, so the board was never dealt'
        : 'This Hand ended before the board was complete, so the rest was never dealt',
    eligible: (count) => `${count} eligible`,
    oddChip: (who) => `odd chip to ${who}`,
    folded: 'folded',
    next: 'Next Hand',
  },

  odds: {
    title: 'Hand odds',
    preflop: 'Preflop',
    madeNow: (category) => `Now: ${category}`,
    cardsToCome: (count) => ` · ${count} to come`,
    settled: ' · final',
  },

  results: {
    title: 'Session over',
    lead: (hands) => `${hands} Hands played, ranked on Score.`,
    rebuys: (count) => (count === 1 ? '1 rebuy' : `${count} rebuys`),
    restart: 'Play again',
  },

  rankings: {
    open: 'Hands',
    openNote: 'What beats what, with examples',
    title: 'Hand rankings',
    lead:
      'Make the best five cards you can from your two hole cards and the five on ' +
      'the board. Strongest first.',
    close: 'Got it',
    notes: {
      8: 'Five in a row, all one suit. Ten through ace is a royal flush, the best hand there is.',
      7: 'All four cards of one rank, plus a kicker.',
      6: 'Three of one rank and two of another. The three decide it first.',
      5: 'Five of one suit, in any order. The highest card decides it.',
      4: 'Five in a row, suits mixed. The ace can also play low, as A-2-3-4-5.',
      3: 'Three of one rank, plus two kickers.',
      2: 'Two ranks paired, plus a kicker.',
      1: 'Two cards of one rank, plus three kickers.',
      0: 'None of the above. The highest card plays, then the next.',
    },
  },
};

export const UI_STRINGS: Record<Locale, UiStrings> = { zh, en };

export const uiStrings = (locale: Locale): UiStrings => UI_STRINGS[locale];
