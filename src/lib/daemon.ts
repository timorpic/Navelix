import { sendTelegramNotification } from "./telegram.ts";
import { isTelegramNotifySystemEnabled } from "./system-settings.ts";
import { maybeRunWeeklyReport } from "./analytics-report.ts";
import { isAnalyticsReportEnabled } from "./analytics-report.ts";
import { scheduleAutoBackup } from "./db-backup.ts";
import { runDatabaseMaintenance } from "./daemon/maintenance.ts";
import { refreshAllModelAccounts } from "./daemon/model-refresh.ts";
import { checkDiskUsage, checkWalSize } from "./daemon/disk.ts";
import { runCloudBackupSchedule } from "./daemon/cloud-backup.ts";

/**
 * 进程内常驻后台守护任务 —— **编排层**。
 *
 * 各任务实现已按类型拆分至 `./daemon/` 子目录：
 * - maintenance.ts   数据库自维护（清理过期会话）
 * - model-refresh.ts 模型配额预拉取 + 书签健康巡检
 * - cloud-backup.ts  Pro 授权下的每日异地云备份
 * - disk.ts          磁盘占用与 WAL 膨胀阈值告警
 *
 * 本文件只负责定时编排与生命周期（启动/停止/防重入）。
 * 公开 API 保持不变，外部仍从 `@/lib/daemon` 导入。
 */

// 全局防重入标记（确保 Next.js 开发热重载或多实例时不重复起定时器）
declare global {
  var __navelix_daemon_started__: boolean | undefined;
  var __navelix_daemon_timers__: NodeJS.Timeout[] | undefined;
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

  // 5. 本地自动备份（每 24 小时检查一次；目录内已有 24 小时内的快照则跳过，
  //    因此与上面的云备份共享同一份快照，不会在同一天重复 VACUUM INTO）
  //
  //    启动后 90 秒补检查一次：scheduleTask 的首次执行也在 delayMs 之后，
  //    若只保留下面这行，进程需连续运行满 24 小时才会首次备份 —— 每天重启
  //    的实例（如定时重建容器的部署）将永远不做本地自动备份，即使磁盘上
  //    最近的快照早已过期。scheduleAutoBackup 本身按快照 mtime 判断，过期
  //    才备份、否则直接返回，因此补跑是幂等的、不会产生重复快照。
  globalThis.__navelix_daemon_timers__.push(
    scheduleTask(() => scheduleAutoBackup(), 24 * 60 * 60 * 1000),
  );
  const autoBackupInit = setTimeout(() => {
    try {
      scheduleAutoBackup();
    } catch {
      // 与 scheduleTask 的 catch 一致：单次失败不影响后续定时轮次
    }
  }, 90_000);
  globalThis.__navelix_daemon_timers__.push(autoBackupInit);

  // 6. 磁盘占用检查（每 6 小时）
  globalThis.__navelix_daemon_timers__.push(
    scheduleTask(() => checkDiskUsage(), 6 * 60 * 60 * 1000),
  );

  // 7. SQLite WAL 文件膨胀检查（每 1 小时）
  globalThis.__navelix_daemon_timers__.push(
    scheduleTask(() => checkWalSize(), 60 * 60 * 1000),
  );

  // 8. 每周匿名聚合上报（M1 路线 A）：启动 60 秒后先尝试一次（覆盖跨周重启），随后每 24 小时检查一次去重键
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

// 保持既有公开 API：外部（含测试）仍可从 @/lib/daemon 取到各任务函数
export { runDatabaseMaintenance } from "./daemon/maintenance.ts";
export { checkBookmarksHealth, refreshAllModelAccounts } from "./daemon/model-refresh.ts";
export { checkDiskUsage, checkWalSize } from "./daemon/disk.ts";
export { runCloudBackupSchedule } from "./daemon/cloud-backup.ts";
