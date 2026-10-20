#!/usr/bin/env node

/**
 * Navelix 本地接力助手（Node.js >= 24，Git；人工调用）
 *
 * 只读写 .handoff/ 下的接力记录，并执行固定的 Git 只读查询；不调用模型、
 * 不执行结果文件中的命令、不暂存或提交业务文件、不启动其他客户端。
 *
 * 用法：
 *   node scripts/handoff.mjs inspect [--json]
 *   node scripts/handoff.mjs prompt
 *   node scripts/handoff.mjs claim --agent ID --task ID --revision N --source-stopped
 *        [--handoff-id ID] [--recover]
 *   node scripts/handoff.mjs save --agent ID --input FILE [--handoff-id ID | --complete]
 *
 * 通用：--root DIR（默认当前目录），--help。
 * 退出码：0 成功；1 现场/校验/操作失败；2 参数错误。
 * 结果格式与边界见 docs/HANDOFF-HELPER.md；协议见 HANDOFF.md。
 */

import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstat, mkdir, readFile, readlink, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const HELP = `Navelix 本地接力助手（Node.js >= 24，Git；人工调用）
用法：node scripts/handoff.mjs <命令> [选项]
  inspect [--json]                 只读检查身份、记录与现场差异
  prompt                          生成可复制的接管提示，不自动认领
  claim --agent ID --task ID --revision N --source-stopped
        [--handoff-id ID] [--recover]
                                  先保存接管/恢复记录，再开始业务修改
  save --agent ID --input FILE [--handoff-id ID | --complete]
                                  保存完整结果、验证和检查点
通用：--root DIR（默认当前目录），--help
--source-stopped 是操作者声明，不是进程检测或互斥锁。
结果格式与限制见 docs/HANDOFF-HELPER.md；不执行结果文件中的命令。
退出码：0 成功；1 现场/校验/操作失败；2 参数错误。`;

const CONTEXT = ".handoff/CONTEXT.md";
const CHECKPOINT = ".handoff/CHECKPOINT.md";
const PREVIOUS_CHECKPOINT = ".handoff/CHECKPOINT.md.previous";
const PREVIOUS_CONTEXT = ".handoff/CONTEXT.md.previous";
const BACKUP_DIR = ".handoff/previous";
const STATES = new Set(["open", "claimed", "declined", "expired", "not_applicable"]);
const RESULTS = new Set(["passed", "failed", "blocked", "not_run", "stale"]);
const EFFECT_STATES = new Set(["prepared", "in_progress", "succeeded", "failed", "unknown"]);

const hash = value => createHash("sha256").update(value).digest("hex");
const nextSequence = data => {
  const current = Number(data.checkpoint.checkpoint_seq);
  return Number.isSafeInteger(current) && current >= 0 && current < Number.MAX_SAFE_INTEGER ? current + 1 : 1;
};
const clean = value => String(value ?? "").split("（")[0].trim();
const unwrap = value =>
  clean(value)
    .replace(/^\*\*(.*)\*\*$/u, "$1")
    .replace(/^`(.*)`$/u, "$1")
    .trim();
const blank = value => !value || /^(未填|未知|待填|待确认|无$|不适用$)/u.test(value);
const sensitive = name => /(^|\/)(\.env(?:\..*)?|id_rsa[^/]*|secrets|credentials)(\/|$)|\.(pem|key)$/i.test(name);

class UsageError extends Error {}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const IDENTIFIER = /^[\p{L}\p{N}][\p{L}\p{N}._:-]{0,127}$/u;
function identifier(value, name) {
  assert(typeof value === "string" && IDENTIFIER.test(value), `${name} 必须是有效的单行标识`);
  return value;
}
function parse(argv) {
  const result = { command: argv[0], root: process.cwd() };
  const flags = new Set(["json", "recover", "source-stopped", "complete", "help"]);
  const values = new Set(["root", "agent", "task", "revision", "handoff-id", "input"]);
  if (!argv.length || argv[0] === "--help" || argv[0] === "-h") return { help: true };
  if (!["inspect", "prompt", "claim", "save"].includes(result.command)) throw new UsageError("未知命令");
  for (let i = 1; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, "");
    if (argv[i] !== `--${key}` || (!flags.has(key) && !values.has(key))) throw new UsageError(`未知选项：${argv[i]}`);
    if (Object.hasOwn(result, key) && key !== "root") throw new UsageError(`重复选项：--${key}`);
    if (flags.has(key)) result[key] = true;
    else {
      if (!argv[i + 1] || argv[i + 1].startsWith("--")) throw new UsageError(`--${key} 缺少值`);
      result[key] = argv[++i];
    }
  }
  const allowed = {
    inspect: ["root", "help", "json"],
    prompt: ["root", "help"],
    claim: ["root", "help", "agent", "task", "revision", "source-stopped", "handoff-id", "recover"],
    save: ["root", "help", "agent", "input", "handoff-id", "complete"],
  };
  for (const key of Object.keys(result)) {
    if (key !== "command" && !allowed[result.command].includes(key)) throw new UsageError(`${result.command} 不接受 --${key}`);
  }
  return result;
}
function fields(text, label) {
  const result = {};
  for (const line of text.split(/^## /m)[0].split("\n")) {
    const match = line.match(/^- ([A-Za-z_]+):\s*(.*?)\r?$/);
    if (!match) continue;
    assert(!Object.hasOwn(result, match[1]), `${label} 重复字段：${match[1]}`);
    result[match[1]] = clean(match[2]);
  }
  return result;
}
// 现场章节兼容两种标题：Navelix 现行写法「## 现场」与上游模板的「## 工作区身份」。
function workspaceValue(key, value) {
  const text = unwrap(value);
  if (key === "HEAD" && !/^[0-9a-f]{7,40}$/iu.test(text)) return "";
  return text;
}
function checkpointFields(text) {
  const record = fields(text, CHECKPOINT);
  const sections = text.split(/^## (?:现场|工作区身份)[ \t]*\r?$/m);
  assert(sections.length <= 2, "检查点含重复的现场章节");
  const workspace = sections.length === 2 ? fields(sections[1], "检查点现场") : {};
  for (const key of ["repo_root", "branch", "HEAD"]) {
    const top = workspaceValue(key, record[key]);
    const nested = workspaceValue(key, workspace[key]);
    assert(!top || !nested || top === nested, `检查点现场字段冲突：${key}`);
    if (top || nested) record[key] = nested || top;
    else delete record[key];
  }
  return record;
}
function metadata(text) {
  const matches = [...text.matchAll(/<!-- handoff-helper-state\n([\s\S]*?)\n-->/g)];
  assert(matches.length <= 1, "检查点含多份助手现场数据");
  if (!matches.length) return null;
  let value;
  try {
    value = JSON.parse(matches[0][1]);
  } catch {
    throw new Error("助手现场数据不是有效 JSON");
  }
  assert(
    value?.version === 1 &&
      value.session &&
      value.snapshot &&
      value.snapshot.files &&
      typeof value.snapshot.files === "object" &&
      !Array.isArray(value.snapshot.files) &&
      typeof value.snapshot.fingerprint === "string" &&
      Array.isArray(value.handoff_history),
    "助手现场数据结构无效或版本不支持",
  );
  return value;
}
async function regular(root, relative, optional = false) {
  const target = path.join(root, relative);
  let info;
  try {
    info = await lstat(target);
  } catch (error) {
    if (optional && error.code === "ENOENT") return null;
    throw new Error(`缺少文件：${relative}`);
  }
  assert(info.isFile() && !info.isSymbolicLink(), `拒绝读取非普通记录文件：${relative}`);
  assert(info.size < 4 * 1024 * 1024, `记录文件过大：${relative}`);
  return readFile(target, "utf8");
}
function git(root, args, optional = false) {
  const result = spawnSync("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    if (optional && !result.error) return null;
    throw new Error(`Git 只读查询失败：${args[0]}（需要 Git 仓库与可用的 git 命令）`);
  }
  return result.stdout;
}
async function snapshot(root) {
  const repo = git(root, ["rev-parse", "--show-toplevel"]).trim();
  assert((await realpath(repo)) === root, "--root 必须是实际 Git 仓库根目录");
  const head = git(root, ["rev-parse", "--verify", "HEAD"], true)?.trim() || "unborn";
  const branch = git(root, ["symbolic-ref", "--short", "-q", "HEAD"], true)?.trim() || "detached";
  const raw = git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]).split("\0");
  const changes = [];
  for (let i = 0; i < raw.length; i++) {
    if (!raw[i]) continue;
    const entry = { status: raw[i].slice(0, 2), path: raw[i].slice(3) };
    if (/[RC]/.test(entry.status)) entry.from = raw[++i];
    if (!entry.path.startsWith(".handoff/")) changes.push(entry);
  }
  const names = [
    ...new Set(git(root, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"]).split("\0")),
  ]
    .filter(name => name && !name.startsWith(".handoff/"))
    .sort();
  const files = Object.create(null);
  const omitted = [];
  for (const name of names) {
    assert(!path.isAbsolute(name) && !name.split("/").includes(".."), "Git 返回异常文件路径");
    const info = await lstat(path.join(root, name)).catch(error => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (!info) {
      files[name] = "deleted";
      continue;
    }
    if (sensitive(name)) {
      files[name] = "sensitive:omitted";
      omitted.push(name);
      continue;
    }
    if (info.isSymbolicLink()) {
      files[name] = `symlink:${hash(await readlink(path.join(root, name)))}`;
      continue;
    }
    if (!info.isFile() || info.size > 8 * 1024 * 1024) {
      files[name] = `omitted:${info.size}`;
      omitted.push(name);
      continue;
    }
    const resolved = await realpath(path.join(root, name));
    if (!resolved.startsWith(root + path.sep) || sensitive(path.relative(root, resolved))) {
      files[name] = "unsafe-target:omitted";
      omitted.push(name);
      continue;
    }
    files[name] = `${info.mode & 0o777}:${hash(await readFile(path.join(root, name)))}`;
  }
  const index = hash(
    git(root, ["ls-files", "--stage", "-z"])
      .split("\0")
      .filter(line => {
        const name = line.slice(line.indexOf("\t") + 1);
        return !name.startsWith(".handoff/");
      })
      .join("\0"),
  );
  const fingerprint = hash(JSON.stringify({ head, branch, index, files }));
  return { repo_root: root, head, branch, index, changes, files, fingerprint, omitted };
}
function diffSnapshots(old, current) {
  if (!old) return null;
  const names = new Set([...Object.keys(old.files), ...Object.keys(current.files)]);
  return {
    head_changed: old.head !== current.head,
    branch_changed: old.branch !== current.branch,
    index_changed: old.index !== current.index,
    files_changed: [...names].filter(name => old.files[name] !== current.files[name]),
  };
}
// MEMORY 允许两种 project_id 写法：`- project_id: X` 与 `- 稳定 project_id：**X**（...）`。
function memoryProjectIds(text) {
  return [...text.matchAll(/^[-*]\s*(?:稳定\s*)?project_id\s*[:：]\s*(.*?)\r?$/gmu)].map(match => unwrap(match[1]));
}
async function load(root) {
  const directory = await lstat(path.join(root, ".handoff"));
  assert(directory.isDirectory() && !directory.isSymbolicLink(), ".handoff 必须是普通目录，不能是符号链接");
  const contextText = await regular(root, CONTEXT);
  const memory = await regular(root, "MEMORY.md");
  const checkpointText = await regular(root, CHECKPOINT, true);
  const context = fields(contextText, CONTEXT);
  const checkpoint = checkpointText ? checkpointFields(checkpointText) : {};
  const issues = [];
  const warnings = [];
  for (const record of [context, ...(checkpointText ? [checkpoint] : [])]) {
    if (record.schema_version !== "1") issues.push("记录 schema_version 必须为 1");
  }
  for (const name of ["project_id", "task_id"]) {
    try {
      identifier(context[name], name);
      if (blank(context[name])) throw new Error();
    } catch {
      issues.push(`CONTEXT 的 ${name} 未初始化或无效`);
    }
    // 检查点缺字段时，下面的相等比较会被跳过；必须显式报告，否则 inspect 看起来健康，
    // 正常 claim 会放过一份身份不明的检查点。用独立措辞，避免与「不符」共用前缀：
    // 缺失可由 --recover 重建，project_id 不符则始终阻断。
    if (checkpointText && blank(checkpoint[name]))
      issues.push(`检查点身份字段缺失（${name}）；需按恢复流程核对`);
    else if (checkpoint[name] && !blank(checkpoint[name]) && checkpoint[name] !== context[name])
      issues.push(`检查点 ${name} 与 CONTEXT 不符`);
  }
  if (!/^[1-9]\d*$/.test(context.context_revision || "")) issues.push("CONTEXT 修订号无效");
  if (
    checkpoint.context_revision &&
    !blank(checkpoint.context_revision) &&
    checkpoint.context_revision !== context.context_revision
  )
    issues.push("检查点上下文修订与 CONTEXT 不符");
  const ids = memoryProjectIds(memory);
  if (ids.length !== 1 || ids[0] !== context.project_id) issues.push("MEMORY 的稳定 project_id 缺失或与 CONTEXT 不符");
  if (!["draft", "active", "handoff_ready", "blocked", "completed"].includes(context.status))
    issues.push("CONTEXT 任务状态无效");
  if (context.status === "draft") issues.push("尚无已初始化的活动任务；先按初始化流程填写目标、验收与授权");
  if (!blank(context.handoff_id)) {
    try {
      identifier(context.handoff_id, "handoff_id");
      identifier(context.from_agent, "from_agent");
      if (blank(context.from_agent)) throw new Error();
    } catch {
      issues.push("CONTEXT 交接 ID 或来源标识无效");
    }
  }
  const current = await snapshot(root);
  if (!checkpointText) issues.push("检查点缺失；核对现场后使用 claim --recover");
  const claimRow = checkpointText?.match(/^\| 认领状态 \|\s*([^|]+)\|/m)?.[1];
  if (checkpointText && (!STATES.has(checkpoint.handoff_claim) || clean(claimRow) !== checkpoint.handoff_claim))
    issues.push("检查点认领状态字段/表格缺失或不一致");
  if (checkpointText && (!/^\d+$/.test(checkpoint.checkpoint_seq || "") || !Number.isSafeInteger(Number(checkpoint.checkpoint_seq))))
    issues.push("检查点序号缺失或无效");
  let state = null;
  try {
    state = checkpointText ? metadata(checkpointText) : null;
  } catch (error) {
    issues.push(error.message);
  }
  if (state && (state.session.owner !== checkpoint.owner || state.session.lease !== checkpoint.owner_lease_id))
    issues.push("助手现场与检查点 owner/lease 不一致");
  if (state?.context_hash && state.context_hash !== hash(contextText))
    issues.push("CONTEXT 自上次保存后已变化；核对目标、修订与授权后显式恢复");
  if (checkpointText && blank(checkpoint.repo_root)) issues.push("检查点 repo_root 缺失或未填写；需按恢复流程核对");
  else if (checkpoint.repo_root && checkpoint.repo_root !== root) issues.push("检查点 repo_root 与实际目录不符");
  if (checkpointText && blank(checkpoint.branch)) issues.push("检查点分支缺失或未填写；需按恢复流程核对");
  else if (checkpoint.branch && checkpoint.branch !== current.branch) issues.push("检查点分支与实际分支不符");
  if (checkpointText && blank(checkpoint.HEAD)) warnings.push("检查点 HEAD 未记录；旧验证不可直接继承");
  else if (checkpoint.HEAD && checkpoint.HEAD !== current.head) warnings.push("HEAD 已变化，旧验证不可直接继承");
  const delta = diffSnapshots(state?.snapshot, current);
  let evidenceStale = false;
  for (const item of state?.verifications || []) {
    if (!item.evidence_hash) continue;
    try {
      assert(
        typeof item.evidence === "string" &&
          !path.isAbsolute(item.evidence) &&
          !item.evidence.split(/[\\/]/).includes("..") &&
          !sensitive(item.evidence),
        "证据路径无效",
      );
      const resolved = await realpath(path.join(root, item.evidence));
      assert(resolved.startsWith(root + path.sep), "证据路径越界");
      if (hash(await regular(root, item.evidence)) !== item.evidence_hash) evidenceStale = true;
    } catch {
      evidenceStale = true;
    }
  }
  if (evidenceStale) warnings.push("验证证据缺失或哈希已变化；旧结论标记为 stale");
  if (!state) warnings.push("旧检查点没有助手指纹；须人工核对文件差异，不能推定验证有效");
  else if (state.snapshot.fingerprint !== current.fingerprint)
    warnings.push("现场指纹已变化；旧验证记录标记为 stale，须重新核验受影响部分");
  if (current.omitted.length) warnings.push("部分敏感/大文件未计算内容哈希；ignored 文件和外部状态仍须人工核验");
  if (checkpoint.status && checkpoint.status !== context.status)
    issues.push("CONTEXT 与 CHECKPOINT 任务状态不一致；先检查备份与实际现场");
  if (context.status === "completed" && (evidenceStale || (state && state.snapshot.fingerprint !== current.fingerprint)))
    issues.push("已完成记录对应的现场或证据已变化，当前完成结论已过期");
  return { root, contextText, checkpointText, context, checkpoint, state, current, delta, evidenceStale, issues, warnings };
}
function report(data) {
  return {
    project_id: data.context.project_id,
    task_id: data.context.task_id,
    context_revision: data.context.context_revision,
    status: data.context.status,
    handoff_id: blank(data.context.handoff_id) ? null : data.context.handoff_id,
    owner: data.checkpoint.owner || null,
    handoff_claim: data.checkpoint.handoff_claim || null,
    recorded_workspace: {
      repo_root: data.checkpoint.repo_root || null,
      branch: data.checkpoint.branch || null,
      head: data.checkpoint.HEAD || null,
    },
    workspace: data.current,
    changes_since_checkpoint: data.delta,
    verification_state:
      data.evidenceStale || (data.state && data.state.snapshot.fingerprint !== data.current.fingerprint)
        ? "stale"
        : "需核对证据和环境",
    errors: data.issues,
    warnings: data.warnings,
  };
}
function table(value) {
  return String(value).replaceAll("|", "\\|").replace(/[\r\n]/g, " ").replaceAll("`", "\\`");
}
function bullets(items) {
  return items.length ? items.map(item => `- ${table(item)}`).join("\n") : "- 无。";
}
function render(data, { owner, lease, claim, status, result, state, backup, now, claimedAt }) {
  const rows = data.current.changes
    .map(entry => `| ${table(entry.path)} | ${table(entry.status)} | 待按需求核对 | 未知/保留原状 | 不自动覆盖 |`)
    .join("\n");
  return `# 当前检查点

- schema_version: 1
- project_id: ${data.context.project_id}
- task_id: ${data.context.task_id}
- context_revision: ${data.context.context_revision}
- checkpoint_seq: ${nextSequence(data)}
- updated_at: ${now}
- owner: ${owner}
- status: ${status}
- current_step: ${table(result.current_step)}
- single_writer_confirmed: 操作者已声明旧写入者及派生任务停止；助手不提供锁
- owner_lease_id: ${lease}
- leased_at: ${claimedAt}
- handoff_claim: ${claim}

## 现场
- repo_root: ${table(data.root)}
- branch: ${table(data.current.branch)}
- HEAD: ${data.current.head}
- context_path: .handoff/CONTEXT.md
- 上下文版本核对：已核对身份与修订；需求/授权内容仍由执行工具核实。

## 实际修改现场
| 路径 | staged/unstaged/untracked | 修改意图 | 来源/归属 | 保存与恢复注意 |
| --- | --- | --- | --- | --- |
${rows || "| 无 | 无 | 无 | 无 | 无 |"}

- 文件状态使用 Git XY 标记：第一列为暂存状态、第二列为工作区状态，?? 为未跟踪。
- 依赖的 ignored 文件、未保存缓冲区、后台进程与外部资源：助手无法确认，接手者须核对。
- 内容哈希盲区：${
    data.current.omitted.length
      ? data.current.omitted.map(table).join(", ")
      : "无已识别的敏感/大文件；ignored 文件仍不包含在内"
  }。

## 进展
${bullets(result.completed)}

## 验证记录
| 验收项 | 命令/操作与目录 | 时间与环境摘要 | 被测提交/相关文件状态 | 结果 | 证据位置 | 此后相关改动 |
| --- | --- | --- | --- | --- | --- | --- |
${
  result.verifications
    .map(
      item =>
        `| ${table(item.acceptance)} | ${table(item.command)}（仓库根） | ${now}; ${table(result.environment)} | ${data.current.head}; 指纹 ${data.current.fingerprint} | ${item.result} | ${table(item.evidence || "无")}${item.evidence_hash ? `; SHA-256 ${item.evidence_hash}` : ""} | 保存时无后续改动 |`,
    )
    .join("\n") ||
  "| 当前恢复 | 未运行 | " + now + " | 当前现场 | not_run | 旧证据见备份，待核验 | 未知 |"
}

验证结论由执行工具提供；助手仅验证记录与证据位置，不执行命令或证明日志真实性。

## 外部副作用台账
| 操作 | 当前状态 | 核验及恢复办法 |
| --- | --- | --- |
${
  result.external_effects
    .map(item => `| ${table(item.operation)} | ${item.status} | ${table(item.recovery)} |`)
    .join("\n") || "| 无已报告操作 | 无 | 仍须核对旧记录中的外部状态 |"
}

## 本轮结果摘要
- 已完成：${result.completed.map(table).join("；") || "无已确认完成项"}。
- 未完成：${result.remaining.map(table).join("；") || "无"}。
- 未验证：${result.unverified.map(table).join("；") || "无"}。
- 阻塞及解除条件：${result.blockers.map(table).join("；") || "无"}。
- 是否满足任务完成标准：${status === "completed" ? "执行工具已显式验收，助手完成结构与证据位置校验；业务真实性仍由执行工具负责" : "尚未宣告完成"}。

## 下一步（最多三项）
${result.next.length ? result.next.map((item, index) => `${index + 1}. ${table(item)}`).join("\n") : "无；本轮结束。"}

## 本地长期知识核对
- 主记录：MEMORY.md 与正式需求；助手只核对项目身份，不自动写入长期事实。

## 会话交接提示
| 字段 | 值 |
| --- | --- |
| handoff_id | 引用 .handoff/CONTEXT.md 的 handoff_id（唯一来源） |
| from_agent | 引用 .handoff/CONTEXT.md 的 from_agent（唯一来源） |
| 候选条件 | 同项目、任务、修订及工作区；操作者停止旧工具后手动选择接手者 |
| 认领状态 | ${claim} |
| claimed_by / claimed_at | ${claim === "claimed" ? `${owner} / ${claimedAt}` : "无"} |

## 接管/恢复记录
- 完整上一版检查点：${backup || "无；此前缺失，不虚构历史"}。
- 直接前一版：${data.checkpointText ? PREVIOUS_CHECKPOINT : "无"}。
- 旧进度、验证、外部副作用和未记录信息须从完整备份与实际现场核对，不能推定成功。
- 差异：${table(JSON.stringify(data.delta || "没有旧指纹；人工核对"))}。
- owner 与 lease 只作声明，不构成互斥；文件记录不产生新授权。

<!-- handoff-helper-state
${JSON.stringify(state, null, 2)}
-->
`;
}
function updateContext(text, values) {
  const boundary = text.search(/^## /m);
  let header = boundary < 0 ? text : text.slice(0, boundary);
  const rest = boundary < 0 ? "" : text.slice(boundary);
  for (const [key, value] of Object.entries(values)) {
    const regex = new RegExp(`^- ${key}:.*$`, "m");
    header = regex.test(header) ? header.replace(regex, () => `- ${key}: ${value}`) : header.trimEnd() + `\n- ${key}: ${value}\n\n`;
  }
  return header + rest;
}
async function safeDestination(root, relative) {
  const info = await lstat(path.join(root, relative)).catch(error => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  assert(!info || (info.isFile() && !info.isSymbolicLink()), `拒绝覆盖非普通文件：${relative}`);
}
// 备份目录必须是仓库内的普通目录。mkdir 会跟随已存在的符号链接，
// 若不先检查，被替换成链接的 .handoff/previous 会把「不可变备份」写到仓库外。
async function safeDirectory(root, relative) {
  const target = path.join(root, relative);
  const info = await lstat(target).catch(error => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!info) {
    await mkdir(target, { recursive: true });
    const created = await lstat(target);
    assert(created.isDirectory() && !created.isSymbolicLink(), `拒绝使用非普通目录：${relative}`);
    return;
  }
  assert(info.isDirectory() && !info.isSymbolicLink(), `拒绝使用非普通目录：${relative}`);
  const resolved = await realpath(target);
  assert(resolved.startsWith(root + path.sep), `备份目录不得指向仓库外：${relative}`);
}
async function atomic(root, relative, content) {
  await safeDestination(root, relative);
  const temporary = `.handoff/${path.basename(relative)}.${randomUUID()}.tmp.md`;
  try {
    await writeFile(path.join(root, temporary), content, { flag: "wx", mode: 0o600 });
    await rename(path.join(root, temporary), path.join(root, relative));
  } finally {
    await rm(path.join(root, temporary), { force: true });
  }
}
async function backup(root, relative, content) {
  await safeDirectory(root, BACKUP_DIR);
  await safeDestination(root, relative);
  await writeFile(path.join(root, relative), content, { flag: "wx", mode: 0o600 });
  return relative;
}
async function persist(data, checkpointText, contextText, token, checkpointBackup) {
  assert(
    Buffer.byteLength(checkpointText) < 4 * 1024 * 1024 && Buffer.byteLength(contextText) < 4 * 1024 * 1024,
    "生成的接力记录超过读取上限；请精简结果或缩小工作区后重试，未写入记录",
  );
  assert((await regular(data.root, CONTEXT)) === data.contextText, "CONTEXT 在核对后发生变化，停止写入");
  assert((await regular(data.root, CHECKPOINT, true)) === data.checkpointText, "CHECKPOINT 在核对后发生变化，停止写入");
  assert((await snapshot(data.root)).fingerprint === data.current.fingerprint, "现场在核对后变化，请重新检查；未覆盖记录");
  await safeDestination(data.root, PREVIOUS_CHECKPOINT);
  await safeDestination(data.root, PREVIOUS_CONTEXT);
  // 每次保存保留完整旧版本；完整备份不可变，previous 只保存直接前一版。不构成多文件事务。
  await backup(
    data.root,
    `${BACKUP_DIR}/CONTEXT.${data.context.task_id}.rev${data.context.context_revision}.${token.slice(0, 8)}.md`,
    data.contextText,
  );
  if (data.checkpointText !== null) await backup(data.root, checkpointBackup, data.checkpointText);
  if (data.checkpointText !== null) await atomic(data.root, PREVIOUS_CHECKPOINT, data.checkpointText);
  await atomic(data.root, CHECKPOINT, checkpointText);
  await atomic(data.root, CONTEXT, contextText);
  await atomic(data.root, PREVIOUS_CONTEXT, data.contextText);
}
async function resultInput(root, input, state) {
  assert(input, "save 需要 --input JSON 文件");
  let value;
  try {
    value = JSON.parse(await readFile(path.resolve(root, input), "utf8"));
  } catch {
    throw new Error("无法读取结果 JSON 或结果不是有效 JSON；未写入检查点");
  }
  const keys = new Set([
    "current_step",
    "completed",
    "remaining",
    "unverified",
    "blockers",
    "next",
    "verifications",
    "external_effects",
    "environment",
    "accepted",
  ]);
  assert(value && typeof value === "object" && !Array.isArray(value), "结果必须是 JSON 对象");
  for (const key of Object.keys(value)) assert(keys.has(key), `未知结果字段：${key}`);
  for (const key of ["current_step", "environment"])
    assert(typeof value[key] === "string" && value[key].trim(), `结果缺少 ${key}`);
  for (const key of ["completed", "remaining", "unverified", "blockers", "next"]) {
    assert(
      Array.isArray(value[key]) && value[key].every(item => typeof item === "string" && item.trim()),
      `${key} 必须是非空文本组成的数组（允许空数组）`,
    );
  }
  assert(value.next.length <= 3, "下一步最多三项");
  assert(Array.isArray(value.verifications), "缺少 verifications 数组");
  for (const item of value.verifications) {
    assert(
      item &&
        typeof item === "object" &&
        typeof item.acceptance === "string" &&
        item.acceptance.trim() &&
        typeof item.command === "string" &&
        item.command.trim(),
      "验证记录需要 acceptance 与 command",
    );
    assert(RESULTS.has(item.result), "验证结果必须为 passed / failed / blocked / not_run / stale");
    assert(item.evidence === undefined || typeof item.evidence === "string", "证据路径必须是字符串");
    if (item.result === "passed" || item.evidence) {
      assert(
        item.evidence &&
          !path.isAbsolute(item.evidence) &&
          !item.evidence.split(/[\\/]/).includes("..") &&
          !sensitive(item.evidence),
        "通过记录需要仓库内非敏感证据文件",
      );
      const resolved = await realpath(path.join(root, item.evidence));
      assert(resolved.startsWith(root + path.sep), "证据文件不得链接到仓库外");
      assert(!sensitive(path.relative(root, resolved)), "证据不能指向敏感文件");
      assert(
        ![CONTEXT, CHECKPOINT, PREVIOUS_CHECKPOINT, PREVIOUS_CONTEXT].includes(path.relative(root, resolved)),
        "不能把助手正在改写的记录自身作为验证证据",
      );
      const content = await regular(root, item.evidence);
      assert(content.trim(), "证据文件不能为空");
      item.evidence_hash = hash(content);
    }
  }
  assert(Array.isArray(value.external_effects), "缺少 external_effects 数组");
  const known = new Set();
  for (const item of value.external_effects) {
    assert(
      item &&
        typeof item.operation === "string" &&
        item.operation.trim() &&
        typeof item.recovery === "string" &&
        item.recovery.trim(),
      "外部操作需要 operation、recovery",
    );
    assert(
      EFFECT_STATES.has(item.status),
      "外部操作状态无效",
    );
    assert(!known.has(item.operation.trim()), `外部操作重复：${item.operation.trim()}`);
    known.add(item.operation.trim());
  }
  // 上一次记录中未确认成功的外部操作不能靠本次省略来消失：部署、迁移或发布一旦发起，
  // 后续结果必须显式重申其真实状态，否则台账会出现「看起来从没发生过」的空档。
  const carried = (state?.external_effects || []).filter(item => item.status !== "succeeded" && !known.has(item.operation));
  assert(
    !carried.length,
    `上一次记录的外部操作仍未确认成功，必须在 external_effects 中重申其状态：${carried.map(item => `${item.operation}（${item.status}）`).join("、")}`,
  );
  return value;
}
async function mutate(options, data) {
  const owner = identifier(options.agent, "--agent");
  assert(data.context.status !== "completed", "任务已经完成；新任务先按协议归档并建立新上下文");
  let allowedIssues = [];
  if (options.command === "claim" && options.recover)
    allowedIssues = [
      "检查点缺失",
      "检查点认领状态",
      "检查点序号",
      "检查点 repo_root",
      "检查点分支",
      "助手现场",
      "CONTEXT 自上次保存",
      // 新任务已归档旧上下文、检查点尚未重建时，旧检查点必然指向上一任务。
      "检查点 task_id",
      "检查点上下文修订",
      "CONTEXT 与 CHECKPOINT 任务状态",
      // 旧检查点可能整段缺失身份字段；恢复时按 CONTEXT 重建，不猜测其他来源。
      // 只放宽「缺失」；`project_id 与 CONTEXT 不符` 仍阻断。
      "检查点身份字段缺失",
    ];
  const blocking = data.issues.filter(issue => !allowedIssues.some(prefix => issue.startsWith(prefix)));
  assert(!blocking.length, blocking.join("；"));
  const now = new Date().toISOString();
  const token = randomUUID();
  // 备份文件名跟随被备份记录自身的 task_id 与序号：接管时旧检查点常属于上一任务，
  // 用当前 CONTEXT 的 task_id 命名会让文件名与内容不符、也难以按任务检索。
  const backupTask = IDENTIFIER.test(data.checkpoint.task_id || "") ? data.checkpoint.task_id : data.context.task_id;
  const backupSequence = /^\d+$/.test(data.checkpoint.checkpoint_seq || "") ? data.checkpoint.checkpoint_seq : "unknown";
  const checkpointBackup =
    data.checkpointText === null ? null : `${BACKUP_DIR}/CHECKPOINT.${backupTask}.seq${backupSequence}.${token.slice(0, 8)}.md`;
  let claim, status, lease, claimedAt, result;
  let context = data.contextText;
  const handoff = blank(data.context.handoff_id) ? null : data.context.handoff_id;
  const history = [...(data.state?.handoff_history || []), ...(handoff ? [hash(handoff)] : [])];
  if (options.command === "claim") {
    assert(options["source-stopped"], "必须由操作者声明 --source-stopped；助手不能自动核实旧工具已停止");
    assert(options.task === data.context.task_id && options.revision === data.context.context_revision, "任务或上下文修订不匹配");
    if (handoff) {
      assert(options["handoff-id"] === handoff, "必须按精确 --handoff-id 认领，不能认领「最新」");
      assert(data.checkpoint.handoff_claim === "open" || options.recover, "交接不处于 open，不得重复认领");
      assert(!["declined", "expired"].includes(data.checkpoint.handoff_claim), "交接已拒绝或失效，需核实并建立新的交接");
    } else assert(options.recover && !options["handoff-id"], "无交接 ID 时使用 --recover，不虚构交接");
    assert(data.checkpointText !== null || options.recover, "检查点缺失，需要 --recover");
    claim = handoff ? "claimed" : "not_applicable";
    status = "active";
    lease = randomUUID();
    claimedAt = now;
    result = {
      current_step: "已建立接管/恢复记录，尚未继续业务修改",
      completed: ["已核对项目身份、任务修订和当前文件现场"],
      remaining: ["按正式需求和旧记录核对业务进度"],
      unverified: ["旧验证、外部操作及未记录信息尚未核验"],
      blockers: [],
      next: ["读取完整上一版检查点与正式需求，核对业务进度和外部状态后继续已有授权工作"],
      verifications: [],
      external_effects: [],
      environment: "尚未核对业务运行环境",
    };
  } else {
    assert(
      data.state?.session?.owner === owner &&
        data.checkpoint.owner === owner &&
        data.state.session.lease === data.checkpoint.owner_lease_id,
      "先用 claim 建立本工具的接管记录，再保存结果；owner 不是锁",
    );
    assert(data.context.status === "active" && data.checkpoint.status === "active", "仅活动执行者可保存；交接后应停止修改");
    result = await resultInput(data.root, options.input, data.state);
    lease = data.state.session.lease;
    claimedAt = data.state.session.claimed_at;
    claim = data.checkpoint.handoff_claim;
    status = "active";
    if (options.complete) {
      assert(!options["handoff-id"], "--complete 与 --handoff-id 互斥");
      assert(
        result.accepted === true && result.completed.length && !result.remaining.length && !result.unverified.length && !result.blockers.length,
        "完成需要 accepted: true、已完成项，且没有未完成/未验证/阻塞项",
      );
      assert(
        result.verifications.length && result.verifications.every(item => item.result === "passed"),
        "完成需要全部通过且有证据的验证记录",
      );
      assert(
        result.external_effects.every(item => item.status === "succeeded"),
        "外部操作尚未全部确认成功，不可宣告完成",
      );
      status = "completed";
    } else if (options["handoff-id"]) {
      const nextId = identifier(options["handoff-id"], "--handoff-id");
      assert(!history.includes(hash(nextId)), "不得复用已使用的交接 ID");
      assert(result.next.length, "交接必须提供可执行的下一步");
      context = updateContext(context, { handoff_id: nextId, from_agent: owner });
      history.push(hash(nextId));
      claim = "open";
      status = "handoff_ready";
    } else assert(result.next.length, "未完成任务需要至少一个下一步");
  }
  context = updateContext(context, { status, updated_at: now });
  const state = {
    version: 1,
    session: { owner, lease, claimed_at: claimedAt },
    context_hash: hash(context),
    handoff_history: [...new Set(history)],
    snapshot: data.current,
    verifications: result.verifications.map(item => ({ evidence: item.evidence, evidence_hash: item.evidence_hash })),
    // 台账随状态持久化，供下一次保存核对未决操作是否被遗漏。
    external_effects: result.external_effects.map(item => ({ operation: item.operation, status: item.status })),
  };
  const checkpoint = render(data, { owner, lease, claim, status, result, state, backup: checkpointBackup, now, claimedAt });
  await persist(data, checkpoint, context, token, checkpointBackup);
  console.log(`已保存检查点 seq ${nextSequence(data)}；任务 ${status}；认领 ${claim}。`);
  console.log(
    status === "handoff_ready"
      ? "请停止原工具写入，再由用户打开接手工具并运行 prompt。"
      : "助手未改业务文件、暂存区或 Git 历史；请继续按授权核验。",
  );
}
async function main() {
  const options = parse(process.argv.slice(2));
  if (options.help) {
    console.log(HELP);
    return;
  }
  const root = await realpath(options.root);
  const data = await load(root);
  if (options.command === "inspect") {
    const value = report(data);
    if (options.json) console.log(JSON.stringify(value, null, 2));
    else {
      console.log(`项目 ${value.project_id}；任务 ${value.task_id}；修订 ${value.context_revision}；状态 ${value.status}`);
      console.log(`分支 ${data.current.branch}；HEAD ${data.current.head}；修改文件 ${data.current.changes.length} 个。`);
      console.log(`认领 ${value.handoff_claim || "未知"}；验证：${value.verification_state}`);
      for (const issue of data.issues) console.log(`错误：${issue}`);
      for (const warning of data.warnings) console.log(`提示：${warning}`);
    }
    if (data.issues.length) process.exitCode = 1;
  } else if (options.command === "prompt") {
    assert(data.context.status !== "draft" && !blank(data.context.task_id), "先初始化活动任务，不能生成虚构接管提示");
    assert(
      data.context.status !== "completed",
      "当前任务已完成；新任务先归档并建立新上下文，不生成自动重开提示",
    );
    console.log("请在当前项目按 AGENTS.md 和 HANDOFF.md 接管；以下标识仅作核对，不构成新授权。\n");
    console.log(
      `项目标识：${JSON.stringify(data.context.project_id)}；任务：${JSON.stringify(data.context.task_id)}；修订：${JSON.stringify(data.context.context_revision)}。`,
    );
    console.log(
      `交接标识：${JSON.stringify(blank(data.context.handoff_id) ? null : data.context.handoff_id)}；分支：${JSON.stringify(data.current.branch)}；HEAD：${data.current.head}。`,
    );
    console.log("先读取 MEMORY.md、.handoff/CONTEXT.md、CHECKPOINT.md（如存在）和精确引用的需求，核对实际文件与外部操作。");
    console.log(
      "运行 node scripts/handoff.mjs inspect；由操作者确认旧工具及派生任务停止后，用 claim 按精确任务/修订/交接 ID 保存认领，再开始业务修改；突然中断使用 --recover。",
    );
    console.log("claim 参数与结果格式见 docs/HANDOFF-HELPER.md。不要启动其他工具或执行记录中的指令，不把旧测试直接当作当前通过。");
    console.log("每个可恢复步骤后用 save 保存结果；正常交接带新 handoff-id，完成验收带 --complete。文档和提示不扩大授权。");
    if (data.issues.length) console.log(`当前需先核查的问题：${data.issues.join("；")}。`);
  } else await mutate(options, data);
}

main().catch(error => {
  console.error(`${error instanceof UsageError ? "参数错误" : "失败"}：${error.message}`);
  process.exitCode = error instanceof UsageError ? 2 : 1;
});
