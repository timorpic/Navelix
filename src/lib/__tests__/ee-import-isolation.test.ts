import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * EE 字节码的导入隔离约束。
 *
 * 背景（2026-10-10 修复）：`ee/index.ts` 曾为取一个公钥常量从 `src/lib/license.ts`
 * 导入，而 `license.ts → db.ts → db/connection.ts` 在模块顶层执行
 * `initSchema(db)` + `runMigrations(db)`。esbuild 因此把整个 DB 层与 13 个迁移
 * 打进 `bundle.jsc`，实测**仅 require 一次字节码就会建库、跑完全部迁移并写出
 * 初始密码文件**，还产生第二个 SQLite 连接；更麻烦的是字节码封存的是编译当日的
 * 迁移树，新增迁移后会出现两套迁移逻辑并存。
 *
 * 这些断言把这层隔离固定下来：改动一旦把 DB 层重新拖回 EE 依赖图，测试立刻失败。
 */

const ROOT = process.cwd();

/** 提取会产生运行时依赖的 specifier（`import type` / `export type` 编译期擦除，跳过） */
function runtimeSpecifiers(file: string): string[] {
  const src = fs.readFileSync(file, "utf8");
  const out: string[] = [];
  const clauseRe = /(?:^|\n)[ \t]*(?:import|export)([^;]*?)from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = clauseRe.exec(src)) !== null) {
    if (/^\s*type\b/.test(m[1])) continue;
    out.push(m[2]);
  }
  const bareRe = /(?:^|\n)[ \t]*import\s*["']([^"']+)["']/g;
  while ((m = bareRe.exec(src)) !== null) out.push(m[1]);
  return out;
}

/** 解析相对导入到仓库内路径；`node:` 与裸包名返回 null */
function resolveLocal(fromFile: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = path.resolve(ROOT, path.dirname(fromFile), spec);
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
      return path.relative(ROOT, cand);
    }
  }
  return null;
}

/** 从入口出发遍历运行时 import 图 */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const spec of runtimeSpecifiers(path.join(ROOT, cur))) {
      const r = resolveLocal(cur, spec);
      if (r !== null && !seen.has(r)) queue.push(r);
    }
  }
  return seen;
}

describe("EE 字节码导入隔离", () => {
  it("公钥常量模块保持零依赖（否则会重新引入 DB 层）", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "src/lib/license-public-key.ts"),
      "utf8",
    );
    assert.equal(
      runtimeSpecifiers(path.join(ROOT, "src/lib/license-public-key.ts")).length,
      0,
      "license-public-key.ts 不得有任何运行时 import",
    );
    // 连 import type 也不该有：保持它是纯粹的常量模块
    assert.ok(
      !/^\s*(import|export)\b.*\bfrom\b/m.test(src),
      "license-public-key.ts 应当是零 import 的纯常量模块",
    );
  });

  it("license.ts 仍按原路径导出公钥（外部契约不变）", async () => {
    const mod = await import("../license.ts");
    const direct = await import("../license-public-key.ts");
    assert.equal(mod.OFFICIAL_PUBLIC_KEY, direct.OFFICIAL_PUBLIC_KEY);
    assert.match(mod.OFFICIAL_PUBLIC_KEY, /BEGIN PUBLIC KEY/);
  });

  it("ee/index.ts 的依赖图不得包含 DB 层与迁移树", (t) => {
    const entry = "ee/index.ts";
    if (!fs.existsSync(path.join(ROOT, entry))) {
      t.skip("ee/ 未提供（CE 环境），跳过 EE 依赖图检查");
      return;
    }

    const reachable = [...reachableFrom(entry)];
    const forbidden = reachable.filter((f) =>
      /(^|\/)db\.ts$|(^|\/)db\/|(^|\/)migrations\/|(^|\/)license\.ts$/.test(f),
    );

    assert.deepEqual(
      forbidden,
      [],
      `EE 依赖图不得包含 DB / 迁移 / license.ts，实际可达：\n${forbidden.join("\n")}`,
    );
    // 公钥模块必须在图内——证明走的是常量模块而非绕过
    assert.ok(
      reachable.includes("src/lib/license-public-key.ts"),
      "EE 应从 license-public-key.ts 取公钥",
    );
  });

  it("加载字节码不触碰数据目录（端到端回归）", async (t) => {
    const jsc = path.join(ROOT, "ee/dist/bundle.jsc");
    if (!fs.existsSync(jsc)) {
      t.skip("ee/dist/bundle.jsc 未提供（CE 环境），跳过字节码加载检查");
      return;
    }
    // 加载字节码会执行它的顶层代码；若依赖图里仍有 db.ts，这里就会建库。
    // 用独立数据目录避免影响真实数据。
    const probeDir = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "navelix-ee-probe-"));
    const originalDataDir = process.env.NAVELIX_DATA_DIR;
    try {
      process.env.NAVELIX_DATA_DIR = probeDir;
      const bytenode = path.join(ROOT, "node_modules/bytenode");
      if (!fs.existsSync(bytenode)) {
        t.skip("bytenode 未安装，跳过字节码加载检查");
        return;
      }
      require(bytenode);
      require(jsc);

      assert.deepEqual(
        fs.readdirSync(probeDir),
        [],
        "加载 EE 字节码不得创建数据库 / 初始密码文件",
      );
    } finally {
      if (originalDataDir === undefined) delete process.env.NAVELIX_DATA_DIR;
      else process.env.NAVELIX_DATA_DIR = originalDataDir;
      fs.rmSync(probeDir, { recursive: true, force: true });
    }
  });
});
