import { writeLog } from "../logging/events.ts";
import { db } from "../db.ts";

/** 清理过期 sessions（每 12 小时执行一次） */
export function runDatabaseMaintenance(): void {
  try {
    const now = Date.now();
    const sessionRes = db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
    if (sessionRes.changes > 0) {
      writeLog({ category: "runtime", event: "database.sessions.cleaned", details: { removed: Number(sessionRes.changes) } });
    }
  } catch {
    writeLog({ category: "runtime", event: "database.maintenance.failed", outcome: "failed", level: "error" });
  }
}
