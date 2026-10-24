#!/usr/bin/env node
// 只读文件范围检查；不执行契约中的任何字符串。
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function validate(contract) {
  if (contract.schema_version !== 1 || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(contract.task_id ?? '') ||
      typeof contract.goal !== 'string' || !contract.goal.trim()) throw new Error('契约身份或目标无效');
  for (const field of ['allowed_paths', 'forbidden_paths']) {
    if (!Array.isArray(contract[field]) || (field === 'allowed_paths' && !contract[field].length)) throw new Error(`${field} 无效`);
    for (const value of contract[field]) {
      if (typeof value !== 'string' || !value || value.startsWith('/') || value.includes('\\') ||
          value.split('/').some(part => !part || part === '.' || part === '..') ||
          (value.includes('*') && !value.endsWith('/**')) || value.slice(0, -3).includes('*')) {
        throw new Error('路径仅支持精确文件或目录/**，不得越出仓库');
      }
    }
  }
  for (const key of ['allow_new_dependencies', 'allow_database_changes', 'allow_api_breaking_changes', 'allow_unrelated_refactor']) {
    if (typeof contract.constraints?.[key] !== 'boolean') throw new Error(`缺少约束 ${key}`);
  }
  if (!Array.isArray(contract.acceptance) || !contract.acceptance.length ||
      contract.acceptance.some(item => typeof item !== 'string' || !item.trim())) throw new Error('验收条件无效');
  return contract;
}
const matches = (file, pattern) => pattern.endsWith('/**')
  ? file.startsWith(pattern.slice(0, -2)) : file === pattern;
export function violations(contract, files) {
  validate(contract);
  return [...new Set(files)].filter(file => contract.forbidden_paths.some(p => matches(file, p)) ||
    !contract.allowed_paths.some(p => matches(file, p)));
}
export function changedFiles(base, head) {
  const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const split = value => value.split('\0').filter(Boolean);
  // 禁用 rename 折叠，同时检查旧路径和新路径；工作区包含已暂存、未暂存及未跟踪文件。
  if (head) return split(git(['diff', '--no-renames', '--name-only', '-z', base, head, '--']));
  return [...split(git(['diff', '--no-renames', '--name-only', '-z', base, '--'])),
    ...split(git(['ls-files', '--others', '--exclude-standard', '-z']))];
}
function main() {
  const [contractPath, base, head, ...extra] = process.argv.slice(2);
  if (!contractPath || !base || extra.length || !/^\.ai\/tasks\/[a-zA-Z0-9_-]+\.json$/.test(contractPath)) {
    throw new Error('用法：node scripts/ai-check.mjs .ai/tasks/<task_id>.json <base-ref> [head-ref]');
  }
  const resolve = ref => execFileSync('git', ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`], { encoding: 'utf8' }).trim();
  const baseSha = resolve(base), headSha = head ? resolve(head) : undefined;
  const contract = validate(JSON.parse(readFileSync(contractPath, 'utf8')));
  if (contractPath !== `.ai/tasks/${contract.task_id}.json`) throw new Error('任务 ID 与文件名不一致');
  const files = changedFiles(baseSha, headSha);
  const invalid = violations(contract, files);
  console.log(JSON.stringify({ task_id: contract.task_id, base: baseSha, head: headSha ?? 'working-tree', files, violations: invalid }, null, 2));
  if (invalid.length) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
