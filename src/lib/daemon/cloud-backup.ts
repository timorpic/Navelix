import { writeLog } from "../logging/events.ts";
import { sendTelegramNotification } from "../telegram.ts";
import { cloudBackupDestination, CLOUD_BACKUP_STATE_KEY, isCloudBackupDue } from "../cloud-backup-state.ts";

let running = false;

/**
 * 自动异地云备份任务（每天定时触发）。
 *
 * 从 `daemon.ts` 拆出，见 `daemon/maintenance.ts` 的说明。
 * 该任务仅在有 Pro 授权且用户显式开启每日云备份时执行。
 */
export async function runCloudBackupSchedule(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const { isEEAvailable } = await import("../ee-bridge/index.ts");
    const { canAccessFeature } = await import("../license.ts");
    if (!isEEAvailable() || !canAccessFeature("s3_backup")) return;

    const { getCloudStorageConfig, uploadBackupToStorage } = await import(
      "../storage-provider.ts"
    );
    const cfg = getCloudStorageConfig();
    if (!cfg.enabled || !cfg.autoBackupDaily || cfg.type === "none") return;

    const { db } = await import("../db.ts");
    const destination = cloudBackupDestination(cfg);
    const state = db.prepare("SELECT value FROM system_settings WHERE key = ?").get(CLOUD_BACKUP_STATE_KEY);
    if (!isCloudBackupDue(typeof state?.value === "string" ? state.value : undefined, destination)) return;

    const { performDatabaseBackup } = await import("../db-backup.ts");
    writeLog({ category: "backup", event: "backup.cloud.started", outcome: "started" });
    const localSnapshot = performDatabaseBackup("daemon-auto-cloud-backup");
    if (!localSnapshot) throw new Error("local-backup-failed");

    const path = await import("node:path");
    const fileName = path.basename(localSnapshot);
    const res = await uploadBackupToStorage(cfg, localSnapshot, fileName);
    if (res.success) {
      const now = Date.now();
      db.prepare("INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
        .run(CLOUD_BACKUP_STATE_KEY, JSON.stringify({ version: 1, destination, lastSuccessAt: now }), now);
      writeLog({ category: "backup", event: "backup.cloud.completed" });
      sendTelegramNotification(
        `✅ Navelix 云备份成功\n\n文件：${fileName}\n位置：${cfg.type} 存储`,
        "backup",
      ).catch(() => {});
    } else {
      writeLog({ category: "backup", event: "backup.cloud.storage.overdue", level: "error", outcome: "failed" });
      sendTelegramNotification(
        `❌ Navelix 云备份上传失败\n\n错误：${res.error || "未知错误"}`,
        "backup",
      ).catch(() => {});
    }
  } catch {
    writeLog({ category: "backup", event: "backup.cloud.storage.overdue", level: "error", outcome: "failed" });
  } finally { running = false; }
}
