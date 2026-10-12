import { db } from "../db.ts";

/** 清理过期 sessions（每 12 小时执行一次） */
export function runDatabaseMaintenance(): void {
  try {
    const now = Date.now();
    const sessionRes = db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
    if (sessionRes.changes > 0) {
      console.log(`[Daemon] 已自动清理 ${sessionRes.changes} 条过期会话`);
    }
  } catch (err) {
    console.warn("[Daemon] 数据库维护失败:", err);
  }
}
