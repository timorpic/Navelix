import { db } from "../db.ts";
import { refreshMonitorAccount } from "../monitor/accounts.ts";
import { emitUserEvent } from "../events.ts";
import { safeFetch } from "../ssrf.ts";

/**
 * 模型账号配额预拉取与书签健康巡检。
 *
 * 从 `daemon.ts` 拆出，见 `daemon/maintenance.ts` 的说明。
 */

/**
 * 后台静默刷新所有已授权的模型监控账号（Antigravity / Codex）
 * 预拉取 5H/7D 配额与剩余天数存入 SQLite，并触发 SSE 推送，
 * 使得用户打开模型监控大盘时直接毫秒级秒开，无需等待 3~5 秒。
 */
export async function refreshAllModelAccounts(): Promise<number> {
  let refreshedCount = 0;
  try {
    const rows = db
      .prepare("SELECT id, user_id, provider, email FROM model_accounts")
      .all() as Array<{ id: string; user_id: string; provider: string; email: string }>;

    for (const row of rows) {
      try {
        await refreshMonitorAccount(row.user_id, row.id);
        emitUserEvent(row.user_id, "monitor:update", {
          accountId: row.id,
          provider: row.provider,
        });
        refreshedCount++;
      } catch (err) {
        console.warn(`[Daemon] 刷新模型账号失败 [${row.provider}:${row.email}]:`, err);
      }
    }
  } catch (err) {
    console.warn("[Daemon] 查询模型账号异常:", err);
  }
  return refreshedCount;
}

/**
 * 后台静默巡检书签健康状态（仅在启用探针驱动时工作）。
 * 注意：此任务仅做 HEAD 探测以预热，探针的授权判定与结果落库在别处。
 */
export async function checkBookmarksHealth(): Promise<void> {
  try {
    const { isEEAvailable } = await import("../ee-bridge/index.ts");
    const { canAccessFeature } = await import("../license.ts");
    if (!isEEAvailable() || !canAccessFeature("link_status_monitor")) return;

    const links = db
      .prepare("SELECT id, user_id, title, url FROM user_links LIMIT 50")
      .all() as Array<{ id: string; user_id: string; title: string; url: string }>;

    for (const link of links) {
      if (!/^https?:\/\//i.test(link.url)) continue;
      try {
        await safeFetch(link.url, {
          method: "HEAD",
          timeoutMs: 5000,
          allowPrivateIPs: false,
        });
      } catch {
        // 忽略单次网络波动
      }
    }
  } catch {
    // 静默忽略
  }
}
