import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";
import { VERSIONED_MIGRATIONS } from "@/lib/migrations/versions/index.ts";
import { resolveDataDir } from "@/lib/data-dir.ts";

const DATA_DIR = resolveDataDir();

/**
 * 容器健康探针 / 健康检查端点（无需鉴权，供 Docker healthcheck + 运维诊断使用）：
 * 1. DB 读校验：SELECT 1
 * 2. DB 完整性：PRAGMA quick_check
 * 3. DB 写锁校验：BEGIN IMMEDIATE → 立即 ROLLBACK（无副作用）
 * 4. 迁移版本号：当前 user_version 与下一个待执行版本
 * 5. 守护进程状态
 * 6. SQLite WAL 文件大小（自托管用户最怕 WAL 膨胀）
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
    // ── DB 三连校验 ──
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

    // ── 迁移版本 ──
    const { user_version } = db.prepare("PRAGMA user_version").get() as {
      user_version: number;
    };
    payload.migrations = {
      current: user_version,
      next:
        VERSIONED_MIGRATIONS.find((m) => m.version > user_version)?.version ??
        null,
    };

    // ── 守护进程状态 ──
    payload.daemon = {
      running: globalThis.__navelix_daemon_started__ === true,
    };

    // ── 磁盘 / WAL 文件大小 ──
    const walPath = path.join(DATA_DIR, "navelix.db-wal");
    const shmPath = path.join(DATA_DIR, "navelix.db-shm");
    const dbPath = path.join(DATA_DIR, "navelix.db");
    const safeSize = (p: string) => {
      try {
        return fs.statSync(p).size;
      } catch {
        return 0;
      }
    };
    payload.disk = {
      dbSizeBytes: safeSize(dbPath),
      walSizeBytes: safeSize(walPath),
      shmSizeBytes: safeSize(shmPath),
    };
  } catch (err) {
    healthy = false;
    payload.status = "degraded";
    payload.db = "error";
    payload.error = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(payload, { status: healthy ? 200 : 503 });
}