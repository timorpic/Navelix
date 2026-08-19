import fs from "node:fs";
import path from "node:path";
import { db } from "./db.ts";
import { recordAuditLog } from "./audit.ts";

const BACKUP_DIR = path.join(process.cwd(), "data", "backups");
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

    return backupPath;
  } catch (err) {
    console.error("[Navelix Backup] Database backup failed:", err);
    return null;
  }
}

/**
 * 清理超出最大数量限制的旧备份
 */
function cleanOldBackups() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;

    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter(
        (f) =>
          f.endsWith(".db") &&
          (f.startsWith("navelix-backup-") || f.startsWith("nexus-backup-")),
      )
      .map((f) => {
        const fullPath = path.join(BACKUP_DIR, f);
        const stat = fs.statSync(fullPath);
        return { name: f, path: fullPath, mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);

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
 * 定时或启动时触发自动备份（最多每 24 小时执行一次）
 */
let lastBackupTime = 0;
export function scheduleAutoBackup() {
  const now = Date.now();
  if (now - lastBackupTime < BACKUP_INTERVAL_MS) return;
  lastBackupTime = now;
  performDatabaseBackup();
}
