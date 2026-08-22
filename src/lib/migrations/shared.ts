import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { DATA_DIR_NAME, ADMIN_PASSWORD_FILE } from "../constants.ts";

export const DATA_DIR = path.join(process.cwd(), DATA_DIR_NAME);

/**
 * 记录初始管理员密码（首次生成/轮换时写入 data/ 目录，目录已被 gitignore）
 */
export function persistAdminPassword(password: string) {
  const file = path.join(DATA_DIR, ADMIN_PASSWORD_FILE);
  try {
    fs.writeFileSync(
      file,
      `Navelix 管理员初始密码（请登录后立即修改，并删除本文件）\n\n用户名: admin\n密码: ${password}\n`,
      "utf8",
    );
  } catch {
    // ignore
  }
  console.warn(
    `[Navelix] 管理员 admin 的初始密码为: ${password}\n请登录后立即修改，并删除 data/${ADMIN_PASSWORD_FILE} 文件。`,
  );
}

/**
 * 为旧库补齐缺失列（首次升级时执行）。
 * 说明：Next.js build 会启动多个 worker 加载此模块，两个 worker 同时
 * ALTER TABLE 时，后到者会得到 "duplicate column name"——捕获并安全忽略。
 */
export function ensureColumn(
  db: DatabaseSync,
  table: string,
  column: string,
  definition: string,
) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  if (!columns.some((c) => c.name === column)) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("duplicate column")) {
        // Another worker beat us to it — nothing to do.
      } else {
        throw e;
      }
    }
  }
}

/**
 * 删除列（SQLite >= 3.35 支持 ALTER TABLE DROP COLUMN）。
 * 多 worker 并发时，后到者读取 table_info 时列已不存在，直接跳过。
 */
export function dropColumn(db: DatabaseSync, table: string, column: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  if (columns.some((c) => c.name === column)) {
    try {
      db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`);
    } catch (err) {
      console.error(
        `[Navelix] 删除列 ${table}.${column} 失败:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}