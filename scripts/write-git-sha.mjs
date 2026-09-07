// Write the current git SHA to git_sha for runtime version reporting.
// Fails gracefully if git is unavailable.
import { execSync } from 'node:child_process';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';

const shas = [
  () => execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(),
  () => process.env.CAPOY_BUILD_SHA,
  () => 'unknown',
];

let sha = 'unknown';
for (const fn of shas) {
  try { const v = fn(); if (v) { sha = v; break; } } catch { /* ignore */ }
}

writeFileSync('git_sha', sha, 'utf8');
console.log(`[git_sha] wrote ${sha}`);
