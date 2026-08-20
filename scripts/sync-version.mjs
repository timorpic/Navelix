#!/usr/bin/env node

/**
 * Navelix 版本号统一同步工具 (Single Source of Truth)
 *
 * 唯一版本真源：package.json 的 version 字段（不含 v 前缀，如 "1.8.1"）。
 * 本脚本将指定版本号同步到所有出现版本的代码位置，避免发版时遗漏不同步。
 *
 * 用法：
 *   node scripts/sync-version.mjs 1.8.1        # 同步全部位置到 1.8.1
 *   node scripts/sync-version.mjs              # 无参数：仅校验当前一致性并在不一致时退出非零
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const PATTERNS = [
  // [文件路径, 正则, 替换函数]
  // package.json 版本字段不含 v 前缀，且必须保持合法 JSON（带引号）
  ["package.json", /"version"\s*:\s*"[^"]*"/, () => `"version": "${version}"`],
  ["Dockerfile", /(ARG NAVELIX_VERSION=)\d+\.\d+\.\d+/g, () => `ARG NAVELIX_VERSION=${version}`], // builder & runner 两处
  ["src/lib/build-info.ts", /DEFAULT_VERSION = "\d+\.\d+\.\d+"/, () => `DEFAULT_VERSION = "${version}"`],
  [
    "src/app/(app)/admin/components/admin-system-tab.tsx",
    /: "v\d+\.\d+\.\d+"/,
    () => `: "v${version}"`,
  ],
];

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exitCode = 1;
}

// 从 args 读取目标版本号
const rawVersion = process.argv[2]?.trim() || "";
const version = rawVersion.replace(/^v/i, "");
const touch = rawVersion.length > 0;

// 校验版本号格式 vX.Y.Z
if (touch && !/^\d+\.\d+\.\d+$/.test(version)) {
  fail(`无效版本号格式 "${version}"，应为 vX.Y.Z 或 X.Y.Z`);
}

let hasMismatch = false;

/** 校验模式：检查所有文件是否与 package.json 一致 */
function verifyAll() {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  const expected = String(pkg.version || "").replace(/^v/i, "");

  for (const [relPath] of PATTERNS) {
    const abs = path.join(rootDir, relPath);
    if (!fs.existsSync(abs)) {
      fail(`找不到文件: ${relPath}`);
      continue;
    }
    const content = fs.readFileSync(abs, "utf8");
    let consistent;
    let cur;
    if (relPath === "package.json") {
      cur = String(JSON.parse(content).version || "").replace(/^v/i, "");
      consistent = cur === expected;
    } else if (relPath === "Dockerfile") {
      const matches = content.match(/ARG NAVELIX_VERSION=\d+\.\d+\.\d+/g) || [];
      consistent = matches.length === 2 && matches.every((m) => m === `ARG NAVELIX_VERSION=${expected}`);
    } else if (relPath === "src/lib/build-info.ts") {
      cur = content.match(/DEFAULT_VERSION = "(\d+\.\d+\.\d+)"/)?.[1] ?? "";
      consistent = cur === expected;
    } else {
      cur = content.match(/: "v(\d+\.\d+\.\d+)"/)?.[1] ?? "";
      consistent = cur === expected;
    }
    if (!consistent) {
      console.error(`✗ ${relPath} 与 package.json (${expected}) 不一致${cur ? `，当前 ${cur}` : ""}`);
      hasMismatch = true;
    }
  }

  if (!hasMismatch) {
    console.log(`✔ 所有版本位置均与 package.json (${expected}) 一致`);
    return true;
  }
  return false;
}

/** 同步模式：将 version 写入所有文件 */
function syncAll() {
  for (const [relPath, re, replacer] of PATTERNS) {
    const abs = path.join(rootDir, relPath);
    if (!fs.existsSync(abs)) {
      fail(`找不到文件: ${relPath}`);
      continue;
    }
    const content = fs.readFileSync(abs, "utf8");

    // 先确认模式存在，避免「已同步」被误报为「未匹配」
    re.lastIndex = 0;
    if (!re.test(content)) {
      fail(`未匹配到版本号: ${relPath} (模式: ${re})`);
      continue;
    }
    const before = content;
    const replaced = before.replace(re, replacer);
    if (replaced === before) {
      console.log(`✔ ${relPath} 已是最新版本 (跳过)`);
      continue;
    }
    fs.writeFileSync(abs, replaced, "utf8");
    console.log(`✔ 已同步 ${relPath} → v${version}`);
  }
}

if (touch) {
  syncAll();
} else {
  verifyAll();
}

if (hasMismatch && !touch) {
  process.exitCode = 1;
}