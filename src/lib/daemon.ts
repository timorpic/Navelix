import { db } from "./db.ts";
import fs from "node:fs";
import path from "node:path";
import { refreshMonitorAccount } from "./monitor/accounts.ts";
import { emitUserEvent } from "./events.ts";
import { safeFetch } from "./ssrf.ts";
import { sendTelegramNotification } from "./telegram.ts";
import { isTelegramNotifySystemEnabled } from "./system-settings.ts";
import { maybeRunWeeklyReport } from "./analytics-report.ts";
import { isAnalyticsReportEnabled } from "./analytics-report.ts";
import { resolveDataDir } from "./data-dir.ts";

const DATA_DIR = resolveDataDir();

// 全局防重入标记（确保 Next.js 开发热重载或多实例时不重复起定时器）
declare global {
  var __navelix_daemon_started__: boolean | undefined;
  var __navelix_daemon_timers__: NodeJS.Timeout[] | undefined;
}

/**
 * 后台静默刷新所有已授权的模型监控账号（Antigravity / Codex）
 * 预拉取 5H/7D 配额与剩余天数存入 SQLite，并触发 SSE 推送，
 * 使得用户打开模型监控大盘时直接毫秒级秒开，无需等待 3~5 秒。
 */
export async function refreshAllModelAccounts(): Promise<number> {
  let refreshedCount = 0;
  try {
    const rows = db
      .prepare(
        "SELECT id, user_id, provider, email FROM model_accounts",
      )
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
 * 后台静默巡检书签健康状态（仅在启用探针驱动时工作）
 */
export async function checkBookmarksHealth(): Promise<void> {
  try {
    const { isEEAvailable } = await import("./ee-bridge/index.ts");
    const { canAccessFeature } = await import("./license.ts");
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

/**
 * 数据库自维护清理任务
 */
export function runDatabaseMaintenance(): void {
  try {
    const now = Date.now();
    // 清理过期 sessions
    const sessionRes = db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
    if (sessionRes.changes > 0) {
      console.log(`[Daemon] 已自动清理 ${sessionRes.changes} 条过期会话`);
    }
  } catch (err) {
    console.warn("[Daemon] 数据库维护失败:", err);
  }
}

/**
 * 自动异地云备份任务（每天定时触发）
 */
export async function runCloudBackupSchedule(): Promise<void> {
  try {
    const { isEEAvailable } = await import("./ee-bridge/index.ts");
    const { canAccessFeature } = await import("./license.ts");
    if (!isEEAvailable() || !canAccessFeature("s3_backup")) return;

    const { getCloudStorageConfig, uploadBackupToStorage } = await import("./storage-provider.ts");
    const cfg = getCloudStorageConfig();
    if (!cfg.enabled || !cfg.autoBackupDaily || cfg.type === "none") return;

    const { performDatabaseBackup } = await import("./db-backup.ts");
    const localSnapshot = performDatabaseBackup("daemon-auto-cloud-backup");
    if (!localSnapshot) return;

    const path = await import("node:path");
    const fileName = path.basename(localSnapshot);
    const res = await uploadBackupToStorage(cfg, localSnapshot, fileName);
    if (res.success) {
      console.log(`[Daemon] 成功完成每日自动异地云备份: ${fileName}`);
      sendTelegramNotification(
        `✅ Navelix 云备份成功\n\n文件：${fileName}\n位置：${cfg.type} 存储`,
        isTelegramNotifySystemEnabled(),
      ).catch(() => {});
    } else {
      console.warn(`[Daemon] 自动异地云备份上传失败:`, res.error);
      sendTelegramNotification(
        `❌ Navelix 云备份上传失败\n\n错误：${res.error || "未知错误"}`,
        isTelegramNotifySystemEnabled(),
      ).catch(() => {});
    }
  } catch (err) {
    console.warn("[Daemon] 自动异地云备份异常:", err);
  }
}

/**
 * 检查 SQLite WAL 文件大小，超过阈值时发送 Telegram 告警。
 * WAL 模式下异常膨胀通常意味着写入压力过大或 checkpoint 未及时回收，
 * 自托管用户最怕"存着存着库爆了不知道"。
 * 阈值：WAL > 256MB 告警；> 1GB 高优先级告警。
 */
export function checkWalSize(): void {
  try {
    const walPath = path.join(DATA_DIR, "navelix.db-wal");
    if (!fs.existsSync(walPath)) return;
    const size = fs.statSync(walPath).size;
    const mb = (b: number) => `${(b / (1024 * 1024)).toFixed(1)} MB`;

    if (size > 1024 * 1024 * 1024) {
      sendTelegramNotification(
        `🚨 Navelix WAL 文件异常膨胀\n\nnavelix.db-wal：${mb(size)}\n已超过 1GB，请立即检查写入异常或执行 VACUUM / checkpoint。`,
        isTelegramNotifySystemEnabled(),
      ).catch(() => {});
    } else if (size > 256 * 1024 * 1024) {
      sendTelegramNotification(
        `⚠️ Navelix WAL 文件偏大\n\nnavelix.db-wal：${mb(size)}\n已超过 256MB，若持续增长建议检查高写入任务。`,
        isTelegramNotifySystemEnabled(),
      ).catch(() => {});
    }
  } catch {
    // WAL 检查失败不影响主流程
  }
}

/**
 * 检查 data 目录磁盘占用，超过阈值时发送 Telegram 告警。
 * 阈值：数据目录 > 2GB，或备份目录 > 1GB。
 */
export function checkDiskUsage(): void {
  try {
    const dataDir = DATA_DIR;
    const backupDir = path.join(dataDir, "backups");
    const notify = () => isTelegramNotifySystemEnabled();

    const dirSize = (dir: string): number => {
      if (!fs.existsSync(dir)) return 0;
      let total = 0;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        try {
          if (entry.isDirectory()) total += dirSize(p);
          else total += fs.statSync(p).size;
        } catch {
          // ignore
        }
      }
      return total;
    };

    const mb = (b: number) => `${(b / (1024 * 1024)).toFixed(1)} MB`;

    const dataSize = dirSize(dataDir);
    const backupSize = dirSize(backupDir);

    if (dataSize > 2 * 1024 * 1024 * 1024) {
      sendTelegramNotification(
        `⚠️ Navelix 数据目录占用过高\n\ndata/ 目录：${mb(dataSize)}\n请及时清理无用数据。`,
        notify(),
      ).catch(() => {});
    }
    if (backupSize > 1024 * 1024 * 1024) {
      sendTelegramNotification(
        `⚠️ Navelix 备份目录占用过高\n\nbackups/ 目录：${mb(backupSize)}\n请及时清理旧备份。`,
        notify(),
      ).catch(() => {});
    }
  } catch {
    // 磁盘检查失败不影响主流程
  }
}

/**
 * 递归 setTimeout 定时任务：任务完成后才安排下一次执行，
 * 避免 setInterval 在异步任务（如云备份上传）超时后产生任务堆积。
 */
type DaemonTask = () => Promise<unknown> | void;

function scheduleTask(task: DaemonTask, delayMs: number): NodeJS.Timeout {
  const timer = setTimeout(() => {
    Promise.resolve()
      .then(task)
      .catch(() => {})
      .finally(() => {
        // 仅当任务仍在运行中时才调度下一轮（stop 后不再续期）
        if (globalThis.__navelix_daemon_started__) {
          scheduleTask(task, delayMs);
        }
      });
  }, delayMs);
  return timer;
}

/**
 * 启动进程内常驻后台守护任务
 */
export function startBackgroundDaemon(): void {
  if (globalThis.__navelix_daemon_started__) {
    return;
  }
  globalThis.__navelix_daemon_started__ = true;
  globalThis.__navelix_daemon_timers__ = [];

  console.log("[Daemon] Navelix 后台守护任务体系已启动");

  // 隐私透明（Trust & Transparency）：首次启动即在控制台显式告知匿名遥测状态。
  // 防止「隐私优先」产品在用户无感知时默认开启上报，破坏信任。
  if (isAnalyticsReportEnabled()) {
    console.log(
      "[Navelix] 匿名遥测默认开启（仅聚合计数，不含个人信息），关闭请设置环境变量 NAVELIX_ANALYTICS_REPORT=off 或在管理后台「个人账号与安全」中关闭",
    );
  }

  // 服务启动通知（系统异常场景：服务重启）
  sendTelegramNotification(
    `🟢 Navelix 服务已启动\n\n${new Date().toLocaleString("zh-CN")}`,
    isTelegramNotifySystemEnabled(),
  ).catch(() => {});

  // 1. 服务启动 10 秒后执行首次模型配额预拉取
  const initTimer = setTimeout(() => {
    refreshAllModelAccounts().catch(() => {});
    runDatabaseMaintenance();
  }, 10_000);
  globalThis.__navelix_daemon_timers__.push(initTimer);

  // 2. 模型配额定时巡检（每 30 分钟，完成后调度下一轮）
  globalThis.__navelix_daemon_timers__.push(
    scheduleTask(() => refreshAllModelAccounts(), 30 * 60 * 1000),
  );

  // 3. 数据库维护任务（每 12 小时）
  globalThis.__navelix_daemon_timers__.push(
    scheduleTask(() => runDatabaseMaintenance(), 12 * 60 * 60 * 1000),
  );

  // 4. 每日自动异地云备份检查（每 24 小时；上传可能因网络超时，完成后才调度下一轮）
  globalThis.__navelix_daemon_timers__.push(
    scheduleTask(() => runCloudBackupSchedule(), 24 * 60 * 60 * 1000),
  );

  // 5. 磁盘占用检查（每 6 小时）
  globalThis.__navelix_daemon_timers__.push(
    scheduleTask(() => checkDiskUsage(), 6 * 60 * 60 * 1000),
  );

  // 6. SQLite WAL 文件膨胀检查（每 1 小时）
  globalThis.__navelix_daemon_timers__.push(
    scheduleTask(() => checkWalSize(), 60 * 60 * 1000),
  );

  // 7. 每周匿名聚合上报（M1 路线 A）：启动 60 秒后先尝试一次（覆盖跨周重启），随后每 24 小时检查一次去重键
  globalThis.__navelix_daemon_timers__.push(
    scheduleTask(
      () => maybeRunWeeklyReport().catch(() => {}),
      24 * 60 * 60 * 1000,
    ),
  );
  const weeklyReportInit = setTimeout(() => {
    maybeRunWeeklyReport().catch(() => {});
  }, 60_000);
  globalThis.__navelix_daemon_timers__.push(weeklyReportInit);
}

/**
 * 停止守护任务（用于测试环境）
 */
export function stopBackgroundDaemon(): void {
  if (globalThis.__navelix_daemon_timers__) {
    for (const t of globalThis.__navelix_daemon_timers__) {
      clearTimeout(t);
      clearInterval(t);
    }
    globalThis.__navelix_daemon_timers__ = [];
  }
  globalThis.__navelix_daemon_started__ = false;
}
