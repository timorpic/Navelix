import { db } from "../db.ts";

/**
 * 数据库自维护清理任务。
 *
 * 从 `daemon.ts` 拆出：原文件混合了 6 类互不相关的后台任务
 * （模型刷新 / 书签巡检 / 库维护 / 云备份 / 磁盘与 WAL 巡检 / 遥测上报），
 * 现按任务类型分模块，`daemon.ts` 只保留编排。
 */

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
