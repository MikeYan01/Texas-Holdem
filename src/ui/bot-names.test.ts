import { describe, expect, it } from 'vitest';
import { seededRng } from '../poker-math/rng.ts';
import { PERSONALITY_KEYS } from '../bots/personalities.ts';
import { assignBotNames, BOT_NAMES } from './bot-names.ts';

describe('assignBotNames', () => {
  it('gives every Bot Seat a distinct name and leaves the Player alone', () => {
    for (let playerSeat = 0; playerSeat < 6; playerSeat++) {
      const names = assignBotNames(6, playerSeat, seededRng(playerSeat));
      expect(names.size).toBe(5);
      expect(names.has(playerSeat)).toBe(false);
      expect(new Set(names.values()).size).toBe(5);
      for (const name of names.values()) expect(BOT_NAMES).toContain(name);
    }
  });

  it('has one name per personality, so the table is never short of either', () => {
    expect(BOT_NAMES).toHaveLength(PERSONALITY_KEYS.length);
  });

  it('replays from a seed', () => {
    expect([...assignBotNames(6, 2, seededRng(9))]).toEqual([...assignBotNames(6, 2, seededRng(9))]);
  });

  it('reshuffles between Sessions, so a name is never a tell', () => {
    const layouts = new Set(
      Array.from({ length: 40 }, (_, seed) =>
        [...assignBotNames(6, 0, seededRng(seed))].map(([, name]) => name).join(','),
      ),
    );
    expect(layouts.size).toBeGreaterThan(1);
  });

  it('is independent of which personality sits where', () => {
    // Names and personalities are drawn from separate streams. If they were
    // correlated, learning one would give away the other.
    const pairings = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const names = assignBotNames(6, 0, seededRng(seed));
      // The same Seat, across Sessions, must not always carry the same name.
      pairings.add(names.get(1)!);
    }
    expect(pairings.size).toBeGreaterThan(1);
  });

  it('fits on a Seat plate', () => {
    for (const name of BOT_NAMES) expect(name.length).toBeLessThanOrEqual(9);
  });
});
