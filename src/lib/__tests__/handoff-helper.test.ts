import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm, readdir, symlink, lstat, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 测试位于 src/lib/__tests__/，仓库根目录在上四级。
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const contexts = ".handoff/CONTEXT.md";
const checkpoints = ".handoff/CHECKPOINT.md";

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  return { code: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}
function cli(root: string, ...args: string[]) {
  return run(process.execPath, [path.join(root, "scripts/handoff.mjs"), ...args], root);
}
function git(root: string, ...args: string[]) {
  const result = run("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", ...args], root);
  assert.equal(result.code, 0, result.stderr);
  return result.stdout;
}
function replace(text: string, key: string, value: string) {
  return text.replace(new RegExp(`^- ${key}:.*$`, "m"), () => `- ${key}: ${value}`);
}

// 夹具沿用 Navelix 现行记录方言：全角冒号的 `- 稳定 project_id：**fixture**（说明）`、
// `## 现场` 章节、反引号包裹的分支、散文式 HEAD，以及 .handoff 随仓库跟踪。
async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const root = await mkdtemp(path.join(os.tmpdir(), "navelix-handoff-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "scripts"), { recursive: true });
  await mkdir(path.join(root, ".handoff/previous"), { recursive: true });
  const helper = await readFile(path.join(source, "scripts/handoff.mjs"));
  await writeFile(path.join(root, "scripts/handoff.mjs"), helper);
  await writeFile(
    path.join(root, "MEMORY.md"),
    "# Memory\n\n- 稳定 project_id：**fixture**（取目标仓库名，非模板目录名）。\n",
  );
  await writeFile(
    path.join(root, contexts),
    [
      "# 活动任务上下文",
      "",
      "- schema_version: 1",
      "- project_id: fixture",
      "- task_id: task-001",
      "- context_revision: 1",
      "- updated_at: 2026-10-20T00:00:00+08:00",
      "- handoff_id: relay-001",
      "- from_agent: source-agent",
      "- status: handoff_ready",
      "",
      "## 用户目标与授权",
      "",
      "仅验证助手行为。",
      "",
    ].join("\n"),
  );
  await writeFile(path.join(root, "business.txt"), "baseline\n");
  git(root, "init", "-q", "-b", "main");
  git(root, "add", ".");
  git(root, "commit", "-qm", "fixture baseline");
  await writeFile(
    path.join(root, checkpoints),
    [
      "# 当前检查点",
      "",
      "- schema_version: 1",
      "- project_id: fixture",
      "- task_id: task-001",
      "- context_revision: 1",
      "- checkpoint_seq: 1",
      "- updated_at: 2026-10-20T00:00:00+08:00",
      "- owner: source-agent",
      "- status: handoff_ready",
      "- current_step: 等待接管",
      "- handoff_claim: open",
      "",
      "## 现场",
      "",
      "- repo_root: " + root,
      "- branch: `main`",
      "- HEAD: 以 `git rev-parse HEAD` 为准",
      "",
      "| 字段 | 值 |",
      "| --- | --- |",
      "| 认领状态 | open |",
      "",
    ].join("\n"),
  );
  git(root, "add", ".");
  git(root, "commit", "-qm", "fixture handoff records");
  await writeFile(path.join(root, "business.txt"), "user staged change\n");
  git(root, "add", "business.txt");
  await writeFile(path.join(root, "scratch.txt"), "user untracked change\n");
  return root;
}

const claim = (root: string, extra: string[] = []) =>
  cli(root, "claim", "--agent", "receiver-1", "--task", "task-001", "--revision", "1", "--handoff-id", "relay-001", "--source-stopped", ...extra);

async function resultFile(root: string, changes: Record<string, unknown> = {}) {
  const result = {
    current_step: "AC-01 完成",
    completed: ["AC-01"],
    remaining: ["AC-02"],
    unverified: ["完整测试"],
    blockers: [],
    next: ["完成 AC-02 并验证"],
    verifications: [],
    external_effects: [],
    environment: "本地 Node.js",
    ...changes,
  };
  const file = ".handoff/result.tmp.json";
  await writeFile(path.join(root, file), JSON.stringify(result));
  return file;
}
async function preserved(root: string) {
  return {
    business: await readFile(path.join(root, "business.txt"), "utf8"),
    scratch: await readFile(path.join(root, "scratch.txt"), "utf8"),
    index: git(root, "diff", "--cached", "--binary"),
    head: git(root, "rev-parse", "HEAD"),
  };
}

test("inspect/prompt 只读，并按 Navelix 记录方言解析现场", async t => {
  const root = await fixture(t);
  const before = await preserved(root);
  const oldContext = await readFile(path.join(root, contexts));
  const oldCheckpoint = await readFile(path.join(root, checkpoints));
  const inspect = cli(root, "inspect", "--json");
  assert.equal(inspect.code, 0, inspect.stderr);
  const data = JSON.parse(inspect.stdout);
  assert.equal(data.task_id, "task-001");
  assert.equal(data.handoff_claim, "open");
  assert.equal(data.recorded_workspace.repo_root, root);
  assert.equal(data.recorded_workspace.branch, "main");
  assert.equal(data.recorded_workspace.head, null, "散文式 HEAD 应视为未记录");
  assert(data.workspace.changes.some((item: { path: string; status: string }) => item.path === "business.txt" && item.status === "M "));
  assert(data.workspace.changes.some((item: { path: string; status: string }) => item.path === "scratch.txt" && item.status === "??"));
  const prompt = cli(root, "prompt");
  assert.equal(prompt.code, 0, prompt.stderr);
  assert.match(prompt.stdout, /relay-001/);
  assert.match(prompt.stdout, /claim/);
  assert.deepEqual(await readFile(path.join(root, contexts)), oldContext);
  assert.deepEqual(await readFile(path.join(root, checkpoints)), oldCheckpoint);
  assert.deepEqual(await preserved(root), before);
});

test("claim 必须先于 save，同步认领表格，保留完整备份并递增序号", async t => {
  const root = await fixture(t);
  const before = await preserved(root);
  const previous = await readFile(path.join(root, checkpoints));
  const input = await resultFile(root);
  assert.equal(cli(root, "save", "--agent", "receiver-1", "--input", input).code, 1);
  const received = claim(root);
  assert.equal(received.code, 0, received.stderr);
  const text = await readFile(path.join(root, checkpoints), "utf8");
  assert.match(text, /- owner: receiver-1/);
  assert.match(text, /- checkpoint_seq: 2/);
  assert.match(text, /- handoff_claim: claimed/);
  assert.match(text, /\| 认领状态 \| claimed \|/);
  assert.match(text, /not_run/);
  assert.deepEqual(await readFile(path.join(root, ".handoff/CHECKPOINT.md.previous")), previous);
  assert.equal(claim(root).code, 1, "已认领的交接不得重复消费");
  const backups = await readdir(path.join(root, ".handoff/previous"));
  assert(backups.some(name => name.startsWith("CHECKPOINT.task-001.seq1.")), "完整旧检查点应写入 previous/");
  assert.equal(cli(root, "save", "--agent", "receiver-1", "--input", input).code, 0);
  assert.equal(cli(root, "inspect", "--json").code, 0);
  assert.deepEqual(await preserved(root), before);
});

test("任务、修订、交接 ID 不符或缺少停止声明时不写入任何记录", async t => {
  const root = await fixture(t);
  const original = await readFile(path.join(root, checkpoints));
  for (const args of [
    ["--agent", "receiver-1", "--task", "wrong", "--revision", "1", "--handoff-id", "relay-001", "--source-stopped"],
    ["--agent", "receiver-1", "--task", "task-001", "--revision", "2", "--handoff-id", "relay-001", "--source-stopped"],
    ["--agent", "receiver-1", "--task", "task-001", "--revision", "1", "--handoff-id", "wrong", "--source-stopped"],
    ["--agent", "receiver-1", "--task", "task-001", "--revision", "1", "--handoff-id", "relay-001"],
  ])
    assert.equal(cli(root, "claim", ...args).code, 1);
  assert.deepEqual(await readFile(path.join(root, checkpoints)), original);
});

test("MEMORY 或检查点身份不符时，恢复流程也不能覆盖", async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, "MEMORY.md"), "# Wrong project\n- 稳定 project_id: other\n");
  assert.equal(claim(root, ["--recover"]).code, 1);
  await writeFile(path.join(root, "MEMORY.md"), "# Memory\n\n- 稳定 project_id：**fixture**（取目标仓库名）。\n");
  const original = await readFile(path.join(root, checkpoints), "utf8");
  await writeFile(path.join(root, checkpoints), replace(original, "project_id", "other"));
  assert.equal(claim(root, ["--recover"]).code, 1);
});

test("突然中断：缺检查点与交接 ID 时用 --recover 重建，不虚构成功", async t => {
  const root = await fixture(t);
  const contextPath = path.join(root, contexts);
  let text = await readFile(contextPath, "utf8");
  text = replace(replace(text, "handoff_id", "无"), "status", "active");
  await writeFile(contextPath, text);
  await rm(path.join(root, checkpoints));
  const command = ["claim", "--agent", "receiver-1", "--task", "task-001", "--revision", "1", "--source-stopped", "--recover"];
  const received = cli(root, ...command);
  assert.equal(received.code, 0, received.stderr);
  const checkpoint = await readFile(path.join(root, checkpoints), "utf8");
  assert.match(checkpoint, /- checkpoint_seq: 1/);
  assert.match(checkpoint, /- handoff_claim: not_applicable/);
  assert.match(checkpoint, /not_run/);
  assert.doesNotMatch(checkpoint, /\| passed \|/);
});

test("恢复可修复缺失的认领表格且不丢失旧记录", async t => {
  const root = await fixture(t);
  const target = path.join(root, checkpoints);
  const old = (await readFile(target, "utf8")).replace(/^\| 认领状态 \|.*$/m, "");
  await writeFile(target, old);
  assert.equal(claim(root).code, 1);
  const recovered = claim(root, ["--recover"]);
  assert.equal(recovered.code, 0, recovered.stderr);
  assert.equal(await readFile(path.join(root, ".handoff/CHECKPOINT.md.previous"), "utf8"), old);
});

test("接管上一任务时，旧检查点备份按自身 task_id 与序号命名", async t => {
  const root = await fixture(t);
  const contextPath = path.join(root, contexts);
  let text = await readFile(contextPath, "utf8");
  text = replace(replace(text, "task_id", "task-002"), "handoff_id", "无");
  await writeFile(contextPath, text);
  const command = ["claim", "--agent", "receiver-1", "--task", "task-002", "--revision", "1", "--source-stopped", "--recover"];
  const recovered = cli(root, ...command);
  assert.equal(recovered.code, 0, recovered.stderr);
  const names = await readdir(path.join(root, ".handoff/previous"));
  assert(names.some(name => name.startsWith("CHECKPOINT.task-001.seq1.")), `旧任务备份应保留原任务名：${names.join(", ")}`);
  assert(!names.some(name => name.startsWith("CHECKPOINT.task-002.")), "不得用新任务名命名旧任务备份");
});

test("正常交接：新 handoff-id 打开认领，原写入者停止，历史备份不可变", async t => {
  const root = await fixture(t);
  const first = await readFile(path.join(root, checkpoints));
  const before = await preserved(root);
  assert.equal(claim(root).code, 0);
  const input = await resultFile(root);
  let saved = cli(root, "save", "--agent", "receiver-1", "--input", input, "--handoff-id", "relay-002");
  assert.equal(saved.code, 0, saved.stderr);
  assert.match(await readFile(path.join(root, contexts), "utf8"), /^- handoff_id: relay-002$/m);
  assert.equal(cli(root, "save", "--agent", "receiver-1", "--input", input).code, 1, "交接后原写入者不得继续保存");
  const incoming = cli(
    root, "claim", "--agent", "receiver-2", "--task", "task-001", "--revision", "1", "--handoff-id", "relay-002", "--source-stopped",
  );
  assert.equal(incoming.code, 0, incoming.stderr);
  saved = cli(root, "save", "--agent", "receiver-2", "--input", input, "--handoff-id", "relay-001");
  assert.equal(saved.code, 1, "不得复用已使用的交接 ID");
  const names = await readdir(path.join(root, ".handoff/previous"));
  const backups = await Promise.all(names.map(name => readFile(path.join(root, ".handoff/previous", name))));
  assert(backups.some(value => value.equals(first)), "原始检查点在多次轮换后仍保留");
  assert.deepEqual(await preserved(root), before);
});

test("完成状态拒绝未完成、未验证、缺证据、未决副作用与非本人调用", async t => {
  const root = await fixture(t);
  assert.equal(claim(root).code, 0);
  const input = await resultFile(root);
  const checkpoint = await readFile(path.join(root, checkpoints));
  assert.equal(cli(root, "save", "--agent", "receiver-1", "--input", input, "--complete").code, 1);
  assert.equal(cli(root, "save", "--agent", "other", "--input", input).code, 1);
  const finished = {
    remaining: [],
    unverified: [],
    next: [],
    accepted: true,
    verifications: [{ acceptance: "AC-01", command: "not executed by helper", result: "passed", evidence: "missing.txt" }],
  };
  await resultFile(root, finished);
  assert.equal(cli(root, "save", "--agent", "receiver-1", "--input", input, "--complete").code, 1);
  await writeFile(path.join(root, ".handoff/test-log.tmp.md"), "Reported by executor: tests passed.\n");
  finished.verifications[0].evidence = ".handoff/test-log.tmp.md";
  await resultFile(root, { ...finished, external_effects: [{ operation: "migration", status: "unknown", recovery: "query operation ID first" }] });
  assert.equal(cli(root, "save", "--agent", "receiver-1", "--input", input, "--complete").code, 1);
  assert.deepEqual(await readFile(path.join(root, checkpoints)), checkpoint);
  await resultFile(root, finished);
  const saved = cli(root, "save", "--agent", "receiver-1", "--input", input, "--complete");
  assert.equal(saved.code, 0, saved.stderr);
  assert.match(await readFile(path.join(root, checkpoints), "utf8"), /- status: completed/);
});

test("代码或暂存区变化使旧验证过期，且不泄露文件内容", async t => {
  const root = await fixture(t);
  assert.equal(claim(root).code, 0);
  assert.equal(cli(root, "inspect", "--json").code, 0);
  await writeFile(path.join(root, "business.txt"), "SECRET_BUSINESS_CONTENT_NOT_FOR_REPORT\n");
  let report = JSON.parse(cli(root, "inspect", "--json").stdout);
  assert.equal(report.verification_state, "stale");
  assert(report.changes_since_checkpoint.files_changed.includes("business.txt"));
  assert(!JSON.stringify(report).includes("SECRET_BUSINESS_CONTENT_NOT_FOR_REPORT"));
  git(root, "add", "business.txt");
  report = JSON.parse(cli(root, "inspect", "--json").stdout);
  assert.equal(report.changes_since_checkpoint.index_changed, true);
});

test("拒绝符号链接记录目标；不读取外部链接与敏感文件内容", async t => {
  const root = await fixture(t);
  const outside = await mkdtemp(path.join(os.tmpdir(), "navelix-handoff-outside-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  const target = path.join(outside, "secret.txt");
  await writeFile(target, "PRIVATE_SENTINEL\n");
  await rm(path.join(root, checkpoints));
  await symlink(target, path.join(root, checkpoints));
  assert.equal(claim(root, ["--recover"]).code, 1);
  assert.equal(await readFile(target, "utf8"), "PRIVATE_SENTINEL\n");
  await rm(path.join(root, checkpoints));
  await symlink(target, path.join(root, "external.txt"));
  await writeFile(path.join(root, "private.key"), "PRIVATE_KEY_SENTINEL");
  const inspected = cli(root, "inspect", "--json");
  assert(!inspected.stdout.includes("PRIVATE_SENTINEL"));
  assert(!inspected.stdout.includes("PRIVATE_KEY_SENTINEL"));
  assert.equal(await lstat(path.join(root, checkpoints)).catch(() => null), null);
});

test("参数错误与已完成任务不会改写记录", async t => {
  assert.equal(cli(source, "inspect", "--nonsense").code, 2);
  const root = await fixture(t);
  const completed = replace(
    replace(await readFile(path.join(root, contexts), "utf8"), "status", "completed"),
    "handoff_id", "无",
  );
  await writeFile(path.join(root, contexts), completed);
  await writeFile(path.join(root, checkpoints), replace(await readFile(path.join(root, checkpoints), "utf8"), "status", "completed"));
  const checkpoint = await readFile(path.join(root, checkpoints));
  assert.equal(claim(root, ["--recover"]).code, 1);
  assert.deepEqual(await readFile(path.join(root, checkpoints)), checkpoint);
  assert.equal(cli(root, "prompt").code, 1);
});

test("证据文件变化或缺失会把旧验证标记为 stale", async t => {
  const root = await fixture(t);
  assert.equal(claim(root).code, 0);
  const evidence = ".handoff/test-log.tmp.md";
  await writeFile(path.join(root, evidence), "Executor reports exit 0\n");
  const input = await resultFile(root, {
    verifications: [{ acceptance: "AC-01", command: "test command", result: "passed", evidence }],
  });
  assert.equal(cli(root, "save", "--agent", "receiver-1", "--input", input).code, 0);
  assert.notEqual(JSON.parse(cli(root, "inspect", "--json").stdout).verification_state, "stale");
  await writeFile(path.join(root, evidence), "Changed reported result\n");
  assert.equal(JSON.parse(cli(root, "inspect", "--json").stdout).verification_state, "stale");
  await rm(path.join(root, evidence));
  assert.equal(JSON.parse(cli(root, "inspect", "--json").stdout).verification_state, "stale");
});

test("恢复可处理旧序号与损坏的助手数据，不猜测项目身份", async t => {
  const root = await fixture(t);
  assert.equal(claim(root).code, 0);
  const file = path.join(root, checkpoints);
  const before = await readFile(file, "utf8");
  const corrupt = replace(
    before.replace(/<!-- handoff-helper-state\n[\s\S]*?\n-->/, "<!-- handoff-helper-state\n{broken}\n-->"),
    "checkpoint_seq",
    "未知",
  );
  await writeFile(file, corrupt);
  assert.equal(cli(root, "inspect").code, 1);
  const received = claim(root, ["--recover"]);
  assert.equal(received.code, 0, received.stderr);
  assert.match(await readFile(file, "utf8"), /- checkpoint_seq: 1/);
  assert.equal(await readFile(path.join(root, ".handoff/CHECKPOINT.md.previous"), "utf8"), corrupt);
});

test("不安全的 previous 备份目标会阻止替换", async t => {
  const root = await fixture(t);
  const original = await readFile(path.join(root, checkpoints));
  await symlink("../business.txt", path.join(root, ".handoff/CHECKPOINT.md.previous"));
  assert.equal(claim(root).code, 1);
  assert.deepEqual(await readFile(path.join(root, checkpoints)), original);
  assert.equal(await readFile(path.join(root, "business.txt"), "utf8"), "user staged change\n");
});

test("同一修订内改动 CONTEXT 需显式恢复，不能静默沿用会话", async t => {
  const root = await fixture(t);
  assert.equal(claim(root).code, 0);
  const input = await resultFile(root);
  const context = await readFile(path.join(root, contexts), "utf8");
  await writeFile(path.join(root, contexts), context + "\nChanged scope must be reviewed.\n");
  assert.equal(cli(root, "save", "--agent", "receiver-1", "--input", input).code, 1);
  assert.equal(claim(root, ["--recover"]).code, 0);
});

test("结果文件中的命令只作为数据保存，不执行；无效 JSON 不回显", async t => {
  const root = await fixture(t);
  assert.equal(claim(root).code, 0);
  await writeFile(path.join(root, ".handoff/log.tmp.md"), "reported result\n");
  const input = await resultFile(root, {
    verifications: [{ acceptance: "AC-01", command: "touch NEVER_EXECUTE_RESULT_COMMAND", result: "passed", evidence: ".handoff/log.tmp.md" }],
  });
  assert.equal(cli(root, "save", "--agent", "receiver-1", "--input", input).code, 0);
  assert.equal(await lstat(path.join(root, "NEVER_EXECUTE_RESULT_COMMAND")).catch(() => null), null);
  await writeFile(path.join(root, input), "{PRIVATE_INVALID_JSON_SENTINEL");
  const invalid = cli(root, "save", "--agent", "receiver-1", "--input", input);
  assert.equal(invalid.code, 1);
  assert(!invalid.stderr.includes("PRIVATE_INVALID_JSON_SENTINEL"));
});

test("完成结论在证据变化后失效，且不能作为新活动交接生成提示", async t => {
  const root = await fixture(t);
  assert.equal(claim(root).code, 0);
  await writeFile(path.join(root, ".handoff/log.tmp.md"), "reported exit 0\n");
  const done = {
    remaining: [],
    unverified: [],
    next: [],
    accepted: true,
    verifications: [{ acceptance: "AC-01", command: "test command", result: "passed", evidence: "./" + checkpoints }],
  };
  const input = await resultFile(root, done);
  assert.equal(cli(root, "save", "--agent", "receiver-1", "--input", input, "--complete").code, 1);
  done.verifications[0].evidence = ".handoff/log.tmp.md";
  await resultFile(root, done);
  assert.equal(cli(root, "save", "--agent", "receiver-1", "--input", input, "--complete").code, 0);
  assert.equal(cli(root, "prompt").code, 1);
  await writeFile(path.join(root, ".handoff/log.tmp.md"), "evidence changed\n");
  const inspected = cli(root, "inspect", "--json");
  assert.equal(inspected.code, 1);
  assert.equal(JSON.parse(inspected.stdout).verification_state, "stale");
});

test("现场章节中的错误根目录或分支会阻止正常认领", async t => {
  const root = await fixture(t);
  const file = path.join(root, checkpoints);
  const original = await readFile(file, "utf8");
  for (const [field, value, expected] of [
    ["repo_root", "/wrong/project/root", /repo_root/],
    ["branch", "wrong-branch", /分支/],
    ["repo_root", "未知", /repo_root/],
    ["branch", "未填", /分支/],
  ] as Array<[string, string, RegExp]>) {
    await writeFile(file, replace(original, field, value));
    const inspected = cli(root, "inspect", "--json");
    assert.equal(inspected.code, 1, `现场章节 ${field} 必须被检查`);
    assert.match(JSON.parse(inspected.stdout).errors.join(" "), expected);
    assert.equal(claim(root).code, 1);
    assert.equal(await readFile(file, "utf8"), replace(original, field, value));
  }
  const recovered = claim(root, ["--recover"]);
  assert.equal(recovered.code, 0, recovered.stderr);
  assert.equal(cli(root, "inspect").code, 0);
});

test("现场章节的 HEAD 漂移即使没有助手快照也会提示", async t => {
  const root = await fixture(t);
  const file = path.join(root, checkpoints);
  await writeFile(file, replace(await readFile(file, "utf8"), "HEAD", "0".repeat(40)));
  const inspected = cli(root, "inspect", "--json");
  assert.match(JSON.parse(inspected.stdout).warnings.join(" "), /HEAD 已变化/);
});

test("未决外部操作不能靠后续空数组抹掉，必须显式重申", async t => {
  const root = await fixture(t);
  assert.equal(claim(root).code, 0);
  const input = await resultFile(root, {
    external_effects: [{ operation: "deploy", status: "in_progress", recovery: "核对部署 ID 与目标环境" }],
  });
  assert.equal(cli(root, "save", "--agent", "receiver-1", "--input", input).code, 0);
  const recorded = await readFile(path.join(root, checkpoints), "utf8");
  assert.match(recorded, /\| deploy \| in_progress \|/);
  await resultFile(root, { external_effects: [] });
  const dropped = cli(root, "save", "--agent", "receiver-1", "--input", input);
  assert.equal(dropped.code, 1, "省略未决外部操作必须被拒绝");
  assert.match(dropped.stderr, /deploy/);
  assert.deepEqual(await readFile(path.join(root, checkpoints), "utf8"), recorded, "拒绝时不得改写台账");
  await resultFile(root, {
    external_effects: [{ operation: "deploy", status: "succeeded", recovery: "已核对部署 ID 与目标版本" }],
  });
  assert.equal(cli(root, "save", "--agent", "receiver-1", "--input", input).code, 0, "确认成功后即可不再重复");
  assert.match(await readFile(path.join(root, checkpoints), "utf8"), /\| deploy \| succeeded \|/);
});

test("previous 被替换为符号链接时拒绝写入仓库外", async t => {
  const root = await fixture(t);
  const outside = await mkdtemp(path.join(os.tmpdir(), "navelix-handoff-outside-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await rm(path.join(root, ".handoff/previous"), { recursive: true, force: true });
  await symlink(outside, path.join(root, ".handoff/previous"));
  assert.equal(claim(root).code, 1);
  assert.deepEqual(await readdir(outside), [], "不得在仓库外写入备份");
});

test("检查点缺少 project_id 或 task_id 时正常认领被拒，恢复仍需核对", async t => {
  const root = await fixture(t);
  const file = path.join(root, checkpoints);
  for (const field of ["project_id", "task_id"]) {
    const stripped = (await readFile(file, "utf8")).replace(new RegExp(`^- ${field}:.*\\n`, "m"), "");
    await writeFile(file, stripped);
    const inspected = cli(root, "inspect", "--json");
    assert.equal(inspected.code, 1, `缺少 ${field} 时 inspect 必须报告`);
    assert.match(JSON.parse(inspected.stdout).errors.join(" "), new RegExp(field));
    assert.equal(claim(root).code, 1, `缺少 ${field} 时不得正常认领`);
    assert.equal(await readFile(file, "utf8"), stripped);
  }
  assert.equal(claim(root, ["--recover"]).code, 0, "恢复流程可重建身份字段");
  // 恢复只放宽「缺失」，不放宽「不符」：否则 --recover 会变成改写项目身份的通道。
  const mismatched = replace(await readFile(file, "utf8"), "project_id", "other");
  await writeFile(file, mismatched);
  assert.equal(claim(root, ["--recover"]).code, 1, "project_id 不符时恢复也必须拒绝");
  assert.equal(await readFile(file, "utf8"), mismatched);
});

test("认领交接时不解除旧写入者发起的外部操作", async t => {
  const root = await fixture(t);
  assert.equal(claim(root).code, 0);
  const input = await resultFile(root, {
    external_effects: [{ operation: "deploy", status: "in_progress", recovery: "核对部署 ID 与目标版本" }],
  });
  assert.equal(cli(root, "save", "--agent", "receiver-1", "--input", input, "--handoff-id", "relay-002").code, 0);
  const incoming = cli(
    root, "claim", "--agent", "receiver-2", "--task", "task-001", "--revision", "1", "--handoff-id", "relay-002", "--source-stopped",
  );
  assert.equal(incoming.code, 0, incoming.stderr);
  const checkpoint = await readFile(path.join(root, checkpoints), "utf8");
  assert.match(checkpoint, /\| deploy \| in_progress \|/, "认领不得清空未决台账");
  assert.match(checkpoint, /核对部署 ID 与目标版本/, "恢复办法应随台账保留");
  await writeFile(path.join(root, ".handoff/log.tmp.md"), "reported exit 0\n");
  await resultFile(root, {
    remaining: [],
    unverified: [],
    next: [],
    accepted: true,
    verifications: [{ acceptance: "AC-01", command: "test command", result: "passed", evidence: ".handoff/log.tmp.md" }],
    external_effects: [],
  });
  assert.equal(
    cli(root, "save", "--agent", "receiver-2", "--input", input, "--complete").code,
    1,
    "接手者不得绕过旧写入者的未决外部操作直接宣告完成",
  );
});

test("外部操作名前后空白被规范化，不会导致永久拒绝", async t => {
  const root = await fixture(t);
  assert.equal(claim(root).code, 0);
  const input = await resultFile(root, {
    external_effects: [{ operation: "  deploy  ", status: "in_progress", recovery: "核对部署状态" }],
  });
  assert.equal(cli(root, "save", "--agent", "receiver-1", "--input", input).code, 0);
  assert.match(await readFile(path.join(root, checkpoints), "utf8"), /\| deploy \| in_progress \|/);
  const repeated = cli(root, "save", "--agent", "receiver-1", "--input", input);
  assert.equal(repeated.code, 0, `重复同一操作应被接受：${repeated.stderr}`);
});

test("检查点缺少上下文修订时必须显式恢复", async t => {
  const root = await fixture(t);
  const file = path.join(root, checkpoints);
  const stripped = (await readFile(file, "utf8")).replace(/^- context_revision:.*\n/m, "");
  await writeFile(file, stripped);
  const inspected = cli(root, "inspect", "--json");
  assert.equal(inspected.code, 1);
  assert.match(JSON.parse(inspected.stdout).errors.join(" "), /context_revision/);
  assert.equal(claim(root).code, 1);
  assert.equal(await readFile(file, "utf8"), stripped);
  const recovered = claim(root, ["--recover"]);
  assert.equal(recovered.code, 0, recovered.stderr);
  assert.match(await readFile(file, "utf8"), /- context_revision: 1/);
  assert.equal(await readFile(path.join(root, ".handoff/CHECKPOINT.md.previous"), "utf8"), stripped);
});

test("损坏的助手元数据集合可被检查并显式恢复", async t => {
  for (const field of ["verifications", "external_effects", "handoff_history"]) {
    for (const invalid of [{}, [null]]) {
      const root = await fixture(t);
      assert.equal(claim(root).code, 0);
      const file = path.join(root, checkpoints);
      const before = await readFile(file, "utf8");
      const corrupt = before.replace(/<!-- handoff-helper-state\n([\s\S]*?)\n-->/, (_match, json: string) => {
        const state = JSON.parse(json);
        state[field] = invalid;
        return `<!-- handoff-helper-state\n${JSON.stringify(state)}\n-->`;
      });
      await writeFile(file, corrupt);
      const inspected = cli(root, "inspect", "--json");
      assert.equal(inspected.code, 1);
      assert.match(JSON.parse(inspected.stdout).errors.join(" "), /助手现场数据结构无效/);
      assert.equal(claim(root).code, 1);
      assert.equal(await readFile(file, "utf8"), corrupt);
      const recovered = claim(root, ["--recover"]);
      assert.equal(recovered.code, 0, recovered.stderr);
      assert.equal(await readFile(path.join(root, ".handoff/CHECKPOINT.md.previous"), "utf8"), corrupt);
    }
  }
});
