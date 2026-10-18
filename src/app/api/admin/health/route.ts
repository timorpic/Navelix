import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { simpleRateLimit } from "@/lib/rate-limit";
import fs from "node:fs";
import path from "node:path";
import { VERSIONED_MIGRATIONS } from "@/lib/migrations/versions/index.ts";
import { resolveDataDir } from "@/lib/data-dir.ts";

const DATA_DIR = resolveDataDir();

/** 管理员深度诊断，全进程每分钟最多一次，避免重复全库扫描。 */
async function GETHandler(req: Request) {
  if (!await requireAdmin(req)) return localizedJson({ error: "需要管理员权限" }, { status: 403 });
  const limit = simpleRateLimit("health-deep-diagnostic", 1, 60_000);
  if (!limit.allowed) return localizedJson({ error: "深度诊断过于频繁" }, {
    status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)), "Cache-Control": "no-store" },
  });
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
    const backupState = db.prepare("SELECT value FROM system_settings WHERE key = 'cloud_backup_schedule_v1'").get();
    let lastCloudSuccessAt: number | null = null;
    try {
      const state: unknown = JSON.parse(typeof backupState?.value === "string" ? backupState.value : "null");
      if (state && typeof state === "object" && "lastSuccessAt" in state &&
          typeof state.lastSuccessAt === "number" && Number.isFinite(state.lastSuccessAt)) lastCloudSuccessAt = state.lastSuccessAt;
    } catch { /* Damaged or absent state is reported as unknown. */ }
    payload.backup = { lastCloudSuccessAt };

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

  return localizedJson(payload, { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
export const GET = withRequestLogging("/api/admin/health", GETHandler);
