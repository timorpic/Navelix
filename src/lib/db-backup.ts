import { db } from "./db.ts";
import { recordAuditLog } from "./audit.ts";
import { sendTelegramNotification } from "./telegram.ts";
import { isTelegramNotifyBackupEnabled } from "./system-settings.ts";
import {
  BACKUP_INTERVAL_MS,
  cleanOldBackups,
  createPhysicalBackup,
  formatFileSize,
  listBackupFiles,
} from "./db-backup-core.ts";

/**
 * 执行 SQLite 在线无锁物理热备份 (VACUUM INTO)，并附带审计日志与 Telegram 通知。
 *
 * 物理动作由 `./db-backup-core.ts` 承担（该模块不依赖 db.ts，用于打断
 * connection → migrations → v11 → db-backup → db 的静态导入环）。
 * 本文件是面向 API / 守护进程的完整版本，公开 API 保持不变。
 */
export function performDatabaseBackup(operatorUserId = "system"): string | null {
  const outcome = createPhysicalBackup(db);

  if (!outcome.ok) {
    sendTelegramNotification(
      `❌ Navelix 数据库备份失败\n\n错误：${outcome.error}`,
      isTelegramNotifyBackupEnabled(),
    ).catch(() => {});
    return null;
  }

  // 同名快照已存在（同秒内重复调用）：沿用原实现的提前返回语义，
  // 不重复写审计日志、不重复发通知。
  if (!outcome.created) {
    return outcome.path;
  }

  // 记录安全审计日志
  recordAuditLog({
    userId: operatorUserId,
    action: "database.backup.created",
    target: outcome.fileName,
    details: `成功创建物理数据库热快照: ${outcome.fileName}`,
  });

  // 保留最近 MAX_BACKUPS 个备份文件，清理旧备份
  cleanOldBackups();

  // 备份完成 Telegram 通知
  sendTelegramNotification(
    `✅ Navelix 数据库备份成功\n\n文件：${outcome.fileName}\n大小：${formatFileSize(outcome.size)}`,
    isTelegramNotifyBackupEnabled(),
  ).catch(() => {});

  return outcome.path;
}

/**
 * 守护进程按日调用的本地自动备份：备份目录中已有 24 小时内的快照则跳过。
 *
 * 节流依据取磁盘上最新备份的 mtime，而不是进程内时间戳，因此：
 * 1. 备份失败不会被静默吞掉 24 小时（下次调度会重试）；
 * 2. 与云备份、手动备份共享同一份快照，同一天不会重复执行 VACUUM INTO（二者都写入 BACKUP_DIR）；
 * 3. 进程重启后不会立刻多备份一份。
 */
export function scheduleAutoBackup() {
  let newestMtime = 0;
  try {
    newestMtime = listBackupFiles()[0]?.mtime ?? 0;
  } catch {
    // 目录不可读时按「需要备份」处理，performDatabaseBackup 内部另有兜底
  }
  if (newestMtime && Date.now() - newestMtime < BACKUP_INTERVAL_MS) return;
  performDatabaseBackup("daemon-auto-backup");
}
