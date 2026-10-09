import fs from "node:fs";
import path from "node:path";
import { db } from "./db.ts";
import { recordAuditLog } from "./audit.ts";
import { logger } from "./logger.ts";
import { sendTelegramNotification } from "./telegram.ts";
import { isTelegramNotifyBackupEnabled } from "./system-settings.ts";
import { resolveDataDir } from "./data-dir.ts";

const BACKUP_DIR = path.join(resolveDataDir(), "backups");
const MAX_BACKUPS = 7;
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * 执行 SQLite 在线无锁物理热备份 (VACUUM INTO)
 * 并自动对备份目录与文件设置严格系统权限 (0700 / 0600)
 */
export function performDatabaseBackup(operatorUserId = "system"): string | null {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
    } else {
      try {
        fs.chmodSync(BACKUP_DIR, 0o700);
      } catch {}
    }

    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("Z", "");
    const backupFileName = `navelix-backup-${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupFileName);

    // 如果文件已存在，跳过
    if (fs.existsSync(backupPath)) return backupPath;

    // 执行 SQLite 原生无锁在线备份
    db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);

    try {
      if (fs.existsSync(backupPath)) {
        fs.chmodSync(backupPath, 0o600);
      }
    } catch {}

    // 记录安全审计日志
    recordAuditLog({
      userId: operatorUserId,
      action: "database.backup.created",
      target: backupFileName,
      details: `成功创建物理数据库热快照: ${backupFileName}`,
    });

    // 保留最近 MAX_BACKUPS 个备份文件，清理旧备份
    cleanOldBackups();

    // 备份完成 Telegram 通知
    sendTelegramNotification(
      `✅ Navelix 数据库备份成功\n\n文件：${backupFileName}\n大小：${formatFileSize(fs.statSync(backupPath).size)}`,
      isTelegramNotifyBackupEnabled(),
    ).catch(() => {});

    return backupPath;
  } catch (err) {
    logger.error("backup failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    sendTelegramNotification(
      `❌ Navelix 数据库备份失败\n\n错误：${err instanceof Error ? err.message : String(err)}`,
      isTelegramNotifyBackupEnabled(),
    ).catch(() => {});
    return null;
  }
}

/** 将字节数格式化为人类可读大小 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * 备份目录中符合命名约定的快照，按 mtime 倒序（最新在前）。
 */
function listBackupFiles(): { name: string; path: string; mtime: number }[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter(
      (f) =>
        f.endsWith(".db") &&
        (f.startsWith("navelix-backup-") || f.startsWith("nexus-backup-")),
    )
    .map((f) => {
      const fullPath = path.join(BACKUP_DIR, f);
      return { name: f, path: fullPath, mtime: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

/**
 * 清理超出最大数量限制的旧备份
 */
function cleanOldBackups() {
  try {
    const files = listBackupFiles();
    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(MAX_BACKUPS);
      for (const item of toDelete) {
        try {
          fs.unlinkSync(item.path);
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }
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
