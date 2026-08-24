#!/usr/bin/env node
// CLI wrapper: fails the build when the engine side has grown a dependency,
// a DOM access, a timer, or an ambient source of randomness or time.
import { checkEngineBoundary, ENGINE_ROOTS } from './engine-boundary.mjs';

const violations = checkEngineBoundary();

if (violations.length === 0) {
  console.log(`engine boundary OK — ${ENGINE_ROOTS.join(', ')} are clean`);
  process.exit(0);
}

console.error(`engine boundary FAILED — ${violations.length} violation(s):\n`);
for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.reason}`);
console.error('\nSee docs/adr/0001-no-backend-pure-engine.md.');
process.exit(1);
