// Print how the five personalities are doing against each other.
//
// Run with: node scripts/measure-bot-balance.ts [sessions]
//
// The experiment itself lives in `src/bots/measure-balance.ts`, shared with the
// regression guard, so this tool and that guard can never be measuring different
// things. Everything here is presentation.

import { measureBalance } from '../src/bots/measure-balance.ts';

const sessions = Number(process.argv[2] ?? 300);
const started = Date.now();
const results = measureBalance({ sessions });
const elapsed = (Date.now() - started) / 1000;

console.log(`\n${sessions} sessions, ${results[0]!.hands} hands per personality (${elapsed.toFixed(0)}s)\n`);
console.log('personality        chips/hand      BB/hand    +/- 1se     total');
for (const r of results) {
  console.log(
    r.key.padEnd(16),
    r.perHand.toFixed(2).padStart(10),
    r.bbPerHand.toFixed(3).padStart(12),
    r.stderr.toFixed(2).padStart(10),
    String(Math.round(r.total)).padStart(10),
  );
}
const total = results.reduce((sum, r) => sum + r.total, 0);
console.log(`\nsum: ${Math.round(total)} (must be 0 — it is a zero-sum game)`);
