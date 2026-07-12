/**
 * Combined coverage report (unit + e2e).
 *
 * Controllers, Prisma repositories, guards, filters and DTOs are exercised by
 * the Supertest e2e suite, not the unit specs, so neither run alone reflects the
 * real coverage. This script runs both with Istanbul JSON output and merges them
 * with nyc (files are keyed by absolute path, so the same source instrumented by
 * both runs is unioned line-by-line).
 *
 * Usage: node scripts/coverage.mjs [--check]
 *   --check  fail the process if global coverage falls under the 80% threshold.
 *
 * The e2e run needs the dev database up (docker compose up) and migrated.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const root = join(import.meta.dirname, '..');
const require = createRequire(join(root, 'noop.js'));
const check = process.argv.includes('--check');
const THRESHOLD = 80;

/** Resolve a package's JS bin entry from its package.json `bin` field. */
function resolveBin(pkg) {
  const pkgJsonPath = require.resolve(`${pkg}/package.json`);
  const { bin } = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  const rel = typeof bin === 'string' ? bin : bin[pkg];
  return join(dirname(pkgJsonPath), rel);
}

const bins = { jest: resolveBin('jest'), nyc: resolveBin('nyc') };

/**
 * Run a local JS bin via `node` (no shell) so absolute paths containing spaces
 * survive as single arguments. Inherits stdio; throws on non-zero exit.
 */
function run(bin, args) {
  console.log(`\n> ${bin} ${args.join(' ')}\n`);
  execFileSync(process.execPath, [bins[bin], ...args], {
    cwd: root,
    stdio: 'inherit',
  });
}

const combinedInput = join(root, 'coverage', '.combined-input');
const unitDir = join(root, 'coverage', 'unit');
const e2eDir = join(root, 'coverage', 'e2e');
rmSync(join(root, 'coverage'), { recursive: true, force: true });
mkdirSync(combinedInput, { recursive: true });

// 1. Unit suite (jest.config.js): instruments application/domain logic.
// Absolute coverageDirectory: the unit config's rootDir is `src`, so a relative
// path would land under src/.
run('jest', [
  '--coverage',
  '--coverageReporters=json',
  `--coverageDirectory=${unitDir}`,
  '--silent',
]);

// 2. E2E suite (test/jest-e2e.json): instruments controllers, repos, guards.
run('jest', [
  '--config',
  'test/jest-e2e.json',
  '--runInBand',
  '--coverage',
  `--coverageDirectory=${e2eDir}`,
  '--silent',
]);

// 3. Collect both coverage-final.json files into one temp dir for nyc.
for (const [name, path] of [
  ['unit', join(unitDir, 'coverage-final.json')],
  ['e2e', join(e2eDir, 'coverage-final.json')],
]) {
  if (!existsSync(path)) {
    console.error(`Missing coverage output: ${path}`);
    process.exit(1);
  }
  cpSync(path, join(combinedInput, `${name}.json`));
}

// 4. Merge + report. nyc unions the two JSON files by file path.
const reportArgs = [
  'report',
  '--temp-dir',
  'coverage/.combined-input',
  '--report-dir',
  'coverage/combined',
  '--reporter=text-summary',
  '--reporter=lcov',
  '--reporter=json-summary',
];
if (check) {
  reportArgs.push(
    '--check-coverage',
    '--lines',
    String(THRESHOLD),
    '--statements',
    String(THRESHOLD),
    '--functions',
    String(THRESHOLD),
    '--branches',
    String(THRESHOLD - 10),
  );
}
run('nyc', reportArgs);

console.log('\nCombined HTML report: coverage/combined/index.html');
