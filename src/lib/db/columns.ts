import type { DatabaseSync } from "node:sqlite";

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
