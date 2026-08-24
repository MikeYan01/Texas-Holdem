'use strict';
// Reference 7-card evaluator, hand-written. Produces ONE comparable integer.
// HIGHER = better. Equal ints => split pot.
// Card encoding: code = rank*4 + suit, rank 0..12 (2..A), suit 0..3. (Matches phe.)

const HIGH_CARD = 0, PAIR = 1, TWO_PAIR = 2, TRIPS = 3, STRAIGHT = 4,
      FLUSH = 5, FULL_HOUSE = 6, QUADS = 7, STRAIGHT_FLUSH = 8;

// category in high bits, then 5 tiebreak ranks at 4 bits each
function pack(cat, a = 0, b = 0, c = 0, d = 0, e = 0) {
  return (cat << 20) | (a << 16) | (b << 12) | (c << 8) | (d << 4) | e;
}

// Highest rank of a 5-card straight in a 13-bit rank mask, or -1.
function straightHigh(mask) {
  for (let hi = 12; hi >= 4; hi--) {
    const need = (1 << hi) | (1 << (hi - 1)) | (1 << (hi - 2)) | (1 << (hi - 3)) | (1 << (hi - 4));
    if ((mask & need) === need) return hi;
  }
  // TRAP: wheel A-2-3-4-5 needs an explicit case; ranks 12,0,1,2,3
  const wheel = (1 << 12) | 1 | (1 << 1) | (1 << 2) | (1 << 3);
  if ((mask & wheel) === wheel) return 3; // 5-high
  return -1;
}

function evaluate7(cards) {
  const rankCount = new Int32Array(13);
  const suitCount = new Int32Array(4);
  const suitMask  = new Int32Array(4);
  let rankMask = 0;

  for (let i = 0; i < 7; i++) {
    const c = cards[i], r = c >> 2, s = c & 3;
    rankCount[r]++; suitCount[s]++; suitMask[s] |= (1 << r); rankMask |= (1 << r);
  }

  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (suitCount[s] >= 5) flushSuit = s;
  if (flushSuit >= 0) {
    const fm = suitMask[flushSuit];
    // TRAP: straight flush must be checked WITHIN the flush suit, never
    // as (hasFlush && hasStraight).
    const sf = straightHigh(fm);
    if (sf >= 0) return pack(STRAIGHT_FLUSH, sf);
    // TRAP: 6- and 7-card flushes -> take the TOP five
    const t = [];
    for (let r = 12; r >= 0 && t.length < 5; r--) if (fm & (1 << r)) t.push(r);
    return pack(FLUSH, t[0], t[1], t[2], t[3], t[4]);
  }

  const quads = [], trips = [], pairs = [], singles = [];
  for (let r = 12; r >= 0; r--) {
    const n = rankCount[r];
    if (n === 4) quads.push(r);
    else if (n === 3) trips.push(r);
    else if (n === 2) pairs.push(r);
    else if (n === 1) singles.push(r);
  }

  if (quads.length) {
    // TRAP: kicker may come from a pair or trips
    let k = -1;
    for (let r = 12; r >= 0; r--) if (r !== quads[0] && rankCount[r] > 0) { k = r; break; }
    return pack(QUADS, quads[0], k);
  }
  // TRAP: two sets of trips is a full house
  if (trips.length >= 2) return pack(FULL_HOUSE, trips[0], trips[1]);
  if (trips.length === 1 && pairs.length >= 1) return pack(FULL_HOUSE, trips[0], pairs[0]);

  const st = straightHigh(rankMask);
  if (st >= 0) return pack(STRAIGHT, st);

  if (trips.length === 1) return pack(TRIPS, trips[0], singles[0], singles[1]);

  if (pairs.length >= 2) {
    // TRAP: 7 cards can hold THREE pairs; kicker may be the third pair's rank
    let k = -1;
    for (let r = 12; r >= 0; r--) if (r !== pairs[0] && r !== pairs[1] && rankCount[r] > 0) { k = r; break; }
    return pack(TWO_PAIR, pairs[0], pairs[1], k);
  }
  if (pairs.length === 1) return pack(PAIR, pairs[0], singles[0], singles[1], singles[2]);
  return pack(HIGH_CARD, singles[0], singles[1], singles[2], singles[3], singles[4]);
}

module.exports = { evaluate7 };
