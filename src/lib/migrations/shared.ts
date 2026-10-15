import { writeLog } from "../logging/events.ts";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { ADMIN_PASSWORD_FILE } from "../constants.ts";
import { resolveDataDir } from "../data-dir.ts";

export const DATA_DIR = resolveDataDir();

/**
 * 记录初始管理员密码（首次生成/轮换时写入 data/ 目录，目录已被 gitignore）
 */
export function persistAdminPassword(password: string) {
  const file = path.join(DATA_DIR, ADMIN_PASSWORD_FILE);
  try {
    fs.writeFileSync(
      file,
      `Navelix 管理员初始密码（请登录后立即修改，并删除本文件）\n\n用户名: admin\n密码: ${password}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
  } catch {
    writeLog({ category: "security", event: "auth.bootstrap.password_file.failed", outcome: "failed", level: "error" });
    return;
  }
  writeLog({ category: "security", event: "auth.bootstrap.password_file", message: "Read navelix-admin-password.txt from the data directory to obtain the initial password." });
}

export { ensureColumn } from "../db/columns.ts";

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
    } catch {
      writeLog({ category: "runtime", event: "database.column.drop_failed", level: "error", outcome: "failed", details: { fieldNames: [table, column] } });
    }
  }
}