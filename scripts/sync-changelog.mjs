#!/usr/bin/env node

/**
 * Navelix 更新日志与 GitHub Release 联动工具
 *
 * 唯一真源：仓库根目录的 CHANGELOG.md。
 * 本脚本负责：校验 / 提取 / 发布当前版本的变更章节到 GitHub Release，
 * 让 Release 页面与「管理后台 → 更新检查」的发布说明不再空白。
 *
 * 用法：
 *   node scripts/sync-changelog.mjs                  # 校验：package.json 版本在 CHANGELOG.md 中有非空章节
 *   node scripts/sync-changelog.mjs --print [版本]    # 打印章节内容（默认取 package.json 版本）
 *   node scripts/sync-changelog.mjs --dry-run [版本]  # 只打印将要执行的 gh 命令与内容，不做任何写操作
 *   node scripts/sync-changelog.mjs --publish [版本]  # 发布章节到 GitHub Release（已存在则 edit，否则 create）
 *
 * 版本参数可写 2.9.5 或 v2.9.5；扩展版本可写 extension-v1.1.0。
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const changelogPath = path.join(rootDir, "CHANGELOG.md");

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exitCode = 1;
}

/** 章节标题匹配：## [2.9.5] - 2026-09-15 / ## [未发布] / ## [extension-v1.1.0] - … */
const SECTION_RE = /^## \[(.+?)\]/;

/** 解析 CHANGELOG.md → Map<规范化标题, { title, body }> */
function parseChangelog(markdown) {
  const lines = markdown.split("\n");
  const sections = new Map();
  let current = null;

  for (const line of lines) {
    // 底部链接定义区（[2.9.5]: https://…）视为结束
    if (/^\[[^\]]+\]:\s+https?:/.test(line)) {
      current = null;
      continue;
    }
    const m = line.match(SECTION_RE);
    if (m) {
      const title = m[1].trim();
      current = { title, lines: [] };
      sections.set(normalize(title), current);
      continue;
    }
    if (current && line.trim() !== "---") {
      current.lines.push(line);
    }
  }

  for (const section of sections.values()) {
    section.body = section.lines.join("\n").trim();
  }
  return sections;
}

/** 规范化版本标识：去 v 前缀、去空白，便于 "v2.9.5" / "2.9.5" 互相匹配 */
function normalize(name) {
  return name.replace(/^v/i, "").trim();
}

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const positional = args.filter((a) => !a.startsWith("--"));
const mode = flags.includes("--publish")
  ? "publish"
  : flags.includes("--dry-run")
    ? "dry-run"
    : flags.includes("--print")
      ? "print"
      : "verify";

const unknown = flags.filter((f) => !["--publish", "--dry-run", "--print"].includes(f));
if (unknown.length > 0) {
  fail(`未知参数: ${unknown.join(", ")}`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const pkgVersion = normalize(String(pkg.version || ""));
const target = normalize(positional[0] || pkgVersion);

if (!target) {
  fail("无法确定目标版本：请在 package.json 中设置 version 或显式传入版本参数");
  process.exit(1);
}

if (!fs.existsSync(changelogPath)) {
  fail("找不到 CHANGELOG.md");
  process.exit(1);
}

const sections = parseChangelog(fs.readFileSync(changelogPath, "utf8"));
const section = sections.get(target);
const unreleased = sections.get("未发布");

// ── 校验模式 ──────────────────────────────────────────────
if (mode === "verify") {
  let ok = true;
  if (!section) {
    fail(`CHANGELOG.md 中找不到 [${target}] 章节，请先补充本次版本的变更说明`);
    ok = false;
  } else if (!/^[-*]\s/m.test(section.body) && !/^###/m.test(section.body)) {
    fail(`CHANGELOG.md 的 [${target}] 章节为空，请补充变更条目`);
    ok = false;
  }
  if (ok) {
    console.log(`✔ CHANGELOG.md 中 [${target}] 章节存在且非空`);
  }
  if (unreleased?.body) {
    console.log(`ℹ [未发布] 下仍有待发布内容，发版时记得整理进对应版本章节`);
  }
  process.exit(process.exitCode ?? 0);
}

// ── 提取与发布模式 ────────────────────────────────────────
if (!section) {
  fail(`CHANGELOG.md 中找不到 [${target}] 章节`);
  process.exit(1);
}
if (!section.body) {
  fail(`CHANGELOG.md 的 [${target}] 章节为空`);
  process.exit(1);
}

const notes = section.body;
const tag = target.startsWith("extension-") ? target : `v${target}`;

if (mode === "print") {
  console.log(notes);
  process.exit(0);
}

// 判断 Release 是否已存在，决定 create 还是 edit
const view = spawnSync("gh", ["release", "view", tag, "--json", "url"], {
  cwd: rootDir,
  encoding: "utf8",
});
const ghMissing = view.error?.code === "ENOENT";
if (ghMissing && mode === "publish") {
  fail("未找到 gh 命令：请先安装并登录 GitHub CLI（https://cli.github.com）");
  process.exit(1);
}
const exists = view.status === 0;
const ghArgs = exists
  ? ["release", "edit", tag, "--notes-file", "-"]
  : ["release", "create", tag, "--title", tag, "--notes-file", "-"];

if (mode === "dry-run") {
  if (ghMissing) {
    console.log("ℹ 未找到 gh 命令，无法判断 Release 是否存在（按 create 预览）");
  }
  console.log(
    `$ gh ${ghArgs.join(" ")}   # Release ${ghMissing ? "存在性未知（未安装 gh）" : exists ? "已存在 → edit" : "不存在 → create"}`,
  );
  console.log("──── 将写入的发布说明 ────");
  console.log(notes);
  process.exit(0);
}

// ── 发布 ─────────────────────────────────────────────────
const result = spawnSync("gh", ghArgs, {
  cwd: rootDir,
  encoding: "utf8",
  input: notes,
});

if (result.error) {
  fail(`调用 gh 失败：${result.error.message}（请确认已安装并登录 GitHub CLI）`);
  process.exit(1);
}
if (result.status !== 0) {
  fail(`gh ${ghArgs[0]} 失败：${(result.stderr || result.stdout || "").trim()}`);
  process.exit(1);
}

console.log(`✔ 已将 [${target}] 章节${exists ? "更新到" : "发布为"} GitHub Release ${tag}`);
console.log(`  ${(result.stdout || "").trim()}`);
