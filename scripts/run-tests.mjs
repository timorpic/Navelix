import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { summarizeCoverage } from './coverage-summary.mjs';
import { spawnSync } from 'node:child_process';

// Always own a fresh directory, even if the caller points NAVELIX_DATA_DIR at production.
const dataDir = mkdtempSync(join(tmpdir(), 'navelix-test-'));
const coverage = process.argv.includes('--coverage');
const args = ['--experimental-strip-types', '--test-concurrency=1'];
if (coverage) {
  mkdirSync('coverage', { recursive: true });
  args.push('--experimental-test-coverage', '--test-coverage-lines=60', '--test-coverage-functions=55', '--test-reporter=spec', '--test-reporter-destination=stdout', '--test-reporter=lcov', '--test-reporter-destination=coverage/node.lcov');
}
args.push('--test', ...process.argv.slice(2).filter(arg => arg !== '--coverage'));
if (!args.some(arg => arg.endsWith('.test.ts'))) args.push('src/**/*.test.ts');
try {
  const testEnv = { ...process.env, NAVELIX_DATA_DIR: dataDir, NAVELIX_ADMIN_PASSWORD: 'isolated-test-only-password' };
  // Node's private marker prevents nested child runners from executing tests.
  delete testEnv.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, args, {
    stdio: 'inherit',
    env: testEnv,
  });
  if (result.error) throw result.error;
  const summary = coverage ? summarizeCoverage('coverage/node.lcov') : null;
  if (summary && summary.percent < 23) {
    console.error('All-source conservative coverage must remain at least 23%.');
    process.exitCode = 1;
  }
  process.exitCode ||= result.status ?? 1;
} finally {
  rmSync(dataDir, { recursive: true, force: true });
}
