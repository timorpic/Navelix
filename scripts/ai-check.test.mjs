import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validate, violations, changedFiles } from './ai-check.mjs';
const contract = { schema_version: 1, task_id: 'sample', goal: '范围检查', allowed_paths: ['src/**'], forbidden_paths: ['src/private/**'], constraints: { allow_new_dependencies: false, allow_database_changes: false, allow_api_breaking_changes: false, allow_unrelated_refactor: false }, acceptance: ['检查越界'] };
test('禁止优先、目录边界和带空格路径', () => {
  assert.deepEqual(violations(contract, ['src/a b.js', 'src/private/key', 'src-other/a']), ['src/private/key', 'src-other/a']);
});
test('非法契约不能通过', () => {
  for (const pattern of ['../src/**', '/src/**', '**', 'src/*.js', 'src/../x', 'src//x']) {
    assert.throws(() => validate({ ...contract, allowed_paths: [pattern] }));
  }
  assert.throws(() => validate({ ...contract, acceptance: [] }));
  assert.throws(() => validate({ ...contract, constraints: {} }));
});
test('Git 差异覆盖删除、重命名、暂存、未暂存和未跟踪文件', () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-scope-'));
  const previous = process.cwd();
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  try {
    git('init'); git('config', 'user.email', 'ci@example.invalid'); git('config', 'user.name', 'CI');
    mkdirSync(join(root, 'src')); writeFileSync(join(root, 'src/old'), 'old'); writeFileSync(join(root, 'deleted'), 'delete');
    git('add', '.'); git('commit', '-m', 'baseline');
    git('mv', 'src/old', 'outside'); rmSync(join(root, 'deleted')); writeFileSync(join(root, 'untracked space'), 'new');
    process.chdir(root);
    assert.deepEqual(new Set(changedFiles('HEAD')), new Set(['src/old', 'outside', 'deleted', 'untracked space']));
    git('add', '.'); git('commit', '-m', 'changes');
    assert.deepEqual(new Set(changedFiles('HEAD^', 'HEAD')), new Set(['src/old', 'outside', 'deleted', 'untracked space']));
  } finally { process.chdir(previous); rmSync(root, { recursive: true, force: true }); }
});

test('主分支前进时只检查 PR 自身改动', () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-scope-upstream-'));
  const previous = process.cwd();
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  try {
    git('init'); git('config', 'user.email', 'ci@example.invalid'); git('config', 'user.name', 'CI');
    mkdirSync(join(root, 'src')); writeFileSync(join(root, 'src/task'), 'baseline');
    git('add', '.'); git('commit', '-m', 'baseline');
    const main = git('branch', '--show-current').toString().trim();
    git('checkout', '-b', 'topic'); writeFileSync(join(root, 'src/task'), 'task change');
    git('add', '.'); git('commit', '-m', 'task');
    git('checkout', main); writeFileSync(join(root, 'upstream-only'), 'upstream change');
    git('add', '.'); git('commit', '-m', 'upstream');
    process.chdir(root);
    const files = changedFiles('HEAD', 'topic');
    assert.deepEqual(files, ['src/task']);
    assert.deepEqual(violations(contract, files), []);
  } finally { process.chdir(previous); rmSync(root, { recursive: true, force: true }); }
});

test('工作区恢复原文后仍检测已暂存的越界修改', () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-scope-index-'));
  const previous = process.cwd();
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  try {
    git('init'); git('config', 'user.email', 'ci@example.invalid'); git('config', 'user.name', 'CI');
    writeFileSync(join(root, 'outside'), 'baseline');
    git('add', '.'); git('commit', '-m', 'baseline');
    writeFileSync(join(root, 'outside'), 'staged violation'); git('add', 'outside');
    writeFileSync(join(root, 'outside'), 'baseline');
    process.chdir(root);
    assert.deepEqual(violations(contract, changedFiles('HEAD')), ['outside']);
  } finally { process.chdir(previous); rmSync(root, { recursive: true, force: true }); }
});
