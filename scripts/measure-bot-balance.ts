// Print how the five personalities are doing against each other, and what they
// are doing while they do it.
//
// Run with: node scripts/measure-bot-balance.ts [sessions]
//
// The experiment itself lives in `src/bots/measure-balance.ts`, shared with the
// regression guard, so this tool and that guard can never be measuring different
// things. Everything here is presentation.
//
// The chip figures are guarded by `balance.slow.test.ts`. The behavioural ones
// are printed and not asserted, deliberately: they are for reading while tuning,
// and asserting them would lock tuning down — the same reasoning that keeps the
// personality tests on relative ordering. The single exception is the
// differentiation spread at the bottom, which is asserted, because without it the
// table can quietly collapse into five copies of one Bot.

import { EQUITY_BANDS, FLOP_ROLES, STACK_DEPTHS } from '../src/bots/behaviour.ts';
import { measureBalance } from '../src/bots/measure-balance.ts';
import { STREETS } from '../src/engine/types.ts';

const sessions = Number(process.argv[2] ?? 300);
const started = Date.now();
const { balance, behaviour } = measureBalance({ sessions });
const elapsed = (Date.now() - started) / 1000;

const pct = (x: number, digits = 1): string => `${(x * 100).toFixed(digits)}%`;
const cell = (text: string, width = 10): string => text.padStart(width);
const heading = (title: string): void =>
  console.log(`\n── ${title} ${'─'.repeat(Math.max(2, 60 - title.length))}`);

console.log(
  `\n${sessions} sessions, ${behaviour.hands} hands, ${behaviour.decisions} decisions (${elapsed.toFixed(0)}s)`,
);

heading('chips');
console.log('personality        chips/hand      BB/hand    +/- 1se     total');
for (const r of balance) {
  console.log(
    r.key.padEnd(16),
    cell(r.perHand.toFixed(2)),
    cell(r.bbPerHand.toFixed(3), 12),
    cell(r.stderr.toFixed(2)),
    cell(String(Math.round(r.total))),
  );
}
const total = balance.reduce((sum, r) => sum + r.total, 0);
console.log(`\nsum: ${Math.round(total)} (must be 0 — it is a zero-sum game)`);

heading('aggression, and how much of it is air');
console.log('personality      aggro  bluff%  bluffs/S ' + STREETS.map((s) => cell(s, 8)).join(''));
for (const b of behaviour.perPersonality) {
  console.log(
    b.key.padEnd(15),
    cell(String(b.aggressive), 6),
    cell(pct(b.bluffShare), 7),
    cell(b.postflopBluffsPerSession.toFixed(2), 8),
    STREETS.map((s) => cell(pct(b.aggressionByStreet[s]), 8)).join(''),
  );
}
console.log(
  `\nfield bluff share of aggression ${pct(behaviour.bluffShare)}` +
    `   ("bluffs/S" is postflop bluffs per Session, per Bot)`,
);

heading('true Equity behind a big bet (60%+ of the pot)');
console.log('personality          n ' + EQUITY_BANDS.map((band) => cell(band, 9)).join(''));
for (const b of behaviour.perPersonality) {
  console.log(
    b.key.padEnd(15),
    cell(String(b.bigBets), 6),
    EQUITY_BANDS.map((band) =>
      cell(b.bigBets === 0 ? '—' : pct(b.bigBetEquity[band] / b.bigBets), 9),
    ).join(''),
  );
}
console.log(
  `\nbig bets with air (<20% Equity), whole table: ${behaviour.bigBetsWithAirPerSession.toFixed(2)} per Session`,
);

heading('all-ins, and the Stack that produced them');
console.log(
  'personality  all-ins  /Sess  <10BB clamped ' +
    STACK_DEPTHS.map((d) => cell(`→shove ${d}`, 13)).join(''),
);
for (const b of behaviour.perPersonality) {
  console.log(
    b.key.padEnd(13),
    cell(String(b.allIns), 6),
    cell(b.allInsPerSession.toFixed(2), 6),
    cell(pct(b.allInsFromShort, 0), 6),
    cell(pct(b.clampedDownShare, 0), 7),
    STACK_DEPTHS.map((d) =>
      cell(
        b.byDepth[d].aggressive === 0 ? '—' : pct(b.byDepth[d].allIns / b.byDepth[d].aggressive, 0),
        13,
      ),
    ).join(''),
  );
}
console.log('\npersonality     chose the push   Upside behind it   Upside when short generally');
for (const b of behaviour.perPersonality) {
  console.log(
    b.key.padEnd(15),
    cell(String(b.chosenGambles), 12),
    cell(b.chosenGambles === 0 ? '—' : pct(b.upsideAtPush), 18),
    cell(pct(b.upsideWhenShort), 28),
  );
}
console.log(
  `\nwhole table ${behaviour.allInsPerSession.toFixed(2)} all-ins per Session, ` +
    `${pct(behaviour.allInsFromShort)} of them from under 10 BB; ` +
    `${pct(behaviour.clampedDownShare)} of intended raises clamped down by the legal maximum`,
);

heading('does the bluff tell a story? (the turn, given the flop)');
console.log('personality     flop role  reached    fires  of which air   checks');
for (const b of behaviour.perPersonality) {
  for (const role of FLOP_ROLES) {
    const t = b.turnAfterFlop[role];
    if (t.reached === 0) continue;
    console.log(
      b.key.padEnd(15),
      role.padEnd(10),
      cell(String(t.reached), 7),
      cell(pct(t.fired / t.reached), 7),
      cell(pct(t.bluffed / t.reached), 13),
      cell(pct(t.checked / t.reached), 8),
    );
  }
}
console.log(`\ntwo-barrel bluff stories: ${behaviour.twoBarrelsPerSession.toFixed(2)} per Session`);

heading('mistakes a Player can see from the sofa');
console.log('personality     checks a lock  highest Equity checked  folds it wanted to raise');
for (const b of behaviour.perPersonality) {
  console.log(
    b.key.padEnd(15),
    cell(String(b.checksHoldingALock), 13),
    cell(pct(b.highestEquityChecked), 23),
    cell(String(b.foldsItWantedToRaise), 25),
  );
}

heading('the table itself');
console.log(`mean live Seats at the flop   ${behaviour.meanLiveSeatsAtFlop.toFixed(2)}`);
console.log(`flops seen by three or more   ${pct(behaviour.threeHandedFlopShare)}`);
console.log(`Rebuys per 100 Hands          ${behaviour.rebuysPer100Hands.toFixed(2)}`);

heading('differentiation (the one behavioural property that is asserted)');
console.log(`spread on bluff share         ${pct(behaviour.spread.bluffShare)}`);
console.log(`spread on all-ins per Session ${behaviour.spread.allInsPerSession.toFixed(2)}`);
