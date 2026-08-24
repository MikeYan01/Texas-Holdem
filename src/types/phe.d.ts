// `phe` ships no TypeScript types (last published 2018; see ADR-0004). It is a dev
// dependency used only for differential testing, so this declares the small slice
// the tests touch rather than the whole surface.
declare module 'phe' {
  /** Card code = rank * 4 + suit, rank 0..12 for 2..A, suit 0..3. */
  export type CardCode = number;

  /** Evaluates 5..7 card codes. NOTE: lower is stronger, the opposite of ours. */
  export function evaluateCardCodes(codes: ArrayLike<CardCode>): number;

  /** Maps a value from `evaluateCardCodes` to 0..8, where 0 is a straight flush. */
  export function handRank(value: number): number;

  export const rankDescription: readonly string[];
  export function cardCode(card: string): CardCode;
  export function cardCodes(cards: readonly string[]): CardCode[];
}
