// Card encoding for the whole engine.
//
// A Card is a plain integer 0..51: `rank * 4 + suit`. Ranks run 0..12 for 2..A,
// suits 0..3 for spades, hearts, diamonds, clubs. Integers rather than objects
// because the equity Monte Carlo has to run tens of thousands of iterations
// without allocating (ADR-0005), and a flat `Int32Array` deck is the only way to
// get there. The layout deliberately matches `phe` so differential tests can feed
// both evaluators the same numbers.

export type Card = number;

/** 0..12, meaning 2..A. Aces are high here; the wheel is special-cased. */
export type Rank = number;

/** 0..3, meaning spades, hearts, diamonds, clubs. */
export type Suit = number;

export const RANK_COUNT = 13;
export const SUIT_COUNT = 4;
export const DECK_SIZE = RANK_COUNT * SUIT_COUNT;

/** Indexed by `Rank`. */
export const RANK_SYMBOLS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;

/** Indexed by `Suit`. */
export const SUIT_SYMBOLS = ['s', 'h', 'd', 'c'] as const;

export const makeCard = (rank: Rank, suit: Suit): Card => rank * SUIT_COUNT + suit;
export const rankOf = (card: Card): Rank => card >> 2;
export const suitOf = (card: Card): Suit => card & 3;

export const FULL_DECK: readonly Card[] = Array.from({ length: DECK_SIZE }, (_, i) => i);

export function formatCard(card: Card): string {
  return `${RANK_SYMBOLS[rankOf(card)]}${SUIT_SYMBOLS[suitOf(card)]}`;
}

export function parseCard(text: string): Card {
  const rank = RANK_SYMBOLS.indexOf(text[0]?.toUpperCase() as (typeof RANK_SYMBOLS)[number]);
  const suit = SUIT_SYMBOLS.indexOf(text[1]?.toLowerCase() as (typeof SUIT_SYMBOLS)[number]);
  if (text.length !== 2 || rank < 0 || suit < 0) throw new Error(`bad card: ${text}`);
  return makeCard(rank, suit);
}

/** `cards('Ah Kh Qh')` — whitespace separated, for tests and fixtures. */
export function parseCards(text: string): Card[] {
  return text.trim().split(/\s+/).filter(Boolean).map(parseCard);
}

export const formatCards = (cards: readonly Card[]): string => cards.map(formatCard).join(' ');
