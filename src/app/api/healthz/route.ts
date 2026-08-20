import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * 容器健康探针 / 健康检查端点（无需鉴权，供 Docker healthcheck 使用）：
 * 1. 读校验：SELECT 1
 * 2. 完整性：PRAGMA quick_check
 * 3. 写锁校验：BEGIN IMMEDIATE → 立即 ROLLBACK（无副作用）
 * 任何一步失败返回 503，避免 SQLite 已损坏/只读时健康检查仍误报绿灯。
 */
export async function GET() {
  const payload: Record<string, unknown> = {
    status: "ok",
    time: Date.now(),
    version: process.env.NAVELIX_VERSION || "",
    buildDate: process.env.NAVELIX_BUILD_DATE || "",
  };
  let healthy = true;

  try {
    const read = db.prepare("SELECT 1 AS ok").get() as { ok: number };
    if (read.ok !== 1) throw new Error("db read check failed");

    const integrity = db.prepare("PRAGMA quick_check").get() as { quick_check: string };
    if (integrity.quick_check !== "ok") {
      throw new Error(`db integrity check failed: ${integrity.quick_check}`);
    }

    try {
      db.exec("BEGIN IMMEDIATE");
      db.exec("ROLLBACK");
    } catch (err) {
      throw new Error(
        `db write lock check failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    payload.db = "ok";
  } catch (err) {
    healthy = false;
    payload.status = "degraded";
    payload.db = "error";
    payload.error = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(payload, { status: healthy ? 200 : 503 });
}