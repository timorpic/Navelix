import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { logger } from "./logger.ts";
import { resolveDataDir } from "./data-dir.ts";

/**
 * 物理热备份内核 —— 刻意不 import `./db.ts`。
 *
 * 背景：`db/connection.ts` 在模块顶层同步调用 `runMigrations(db)`，而迁移 v11
 * 需要「改结构前先备份」。若 v11 直接 import `./db-backup.ts`，就会形成
 * `connection → migrations → v11 → db-backup → db → connection` 的静态导入环：
 * 环本身能跑（因为 db-backup 只在函数体内解引用 db），但任何人在 db-backup
 * 顶层加一行 `db.prepare(...)` 都会让启动期直接 TDZ 崩溃。
 *
 * 因此把「纯物理动作」下沉到本文件：db 由调用方以参数传入，依赖只剩
 * fs / path / logger / data-dir，全部是叶子模块，环被彻底切断。
 *
 * 需要审计日志与 Telegram 通知的调用方，请使用 `./db-backup.ts`。
 */

const BACKUP_DIR = path.join(resolveDataDir(), "backups");
const MAX_BACKUPS = 7;
export const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type BackupOutcome =
  | {
      ok: true;
      path: string;
      fileName: string;
      size: number;
      /** false 表示该文件名已存在（同秒内重复调用），本次未真正执行 VACUUM INTO */
      created: boolean;
    }
  | { ok: false; error: string };

/**
 * 执行 SQLite 在线无锁物理热备份 (VACUUM INTO)
 * 并自动对备份目录与文件设置严格系统权限 (0700 / 0600)
 */
export function createPhysicalBackup(db: DatabaseSync): BackupOutcome {
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
    const fileName = `navelix-backup-${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, fileName);

    // 如果文件已存在，跳过（同秒内重复调用）
    if (fs.existsSync(backupPath)) {
      return {
        ok: true,
        path: backupPath,
        fileName,
        size: fs.statSync(backupPath).size,
        created: false,
      };
    }

    // 执行 SQLite 原生无锁在线备份
    db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);

    try {
      if (fs.existsSync(backupPath)) {
        fs.chmodSync(backupPath, 0o600);
      }
    } catch {}

    return {
      ok: true,
      path: backupPath,
      fileName,
      size: fs.existsSync(backupPath) ? fs.statSync(backupPath).size : 0,
      created: true,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("backup failed", { error: message });
    return { ok: false, error: message };
  }
}

/** 将字节数格式化为人类可读大小 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * 备份目录中符合命名约定的快照，按 mtime 倒序（最新在前）。
 */
export function listBackupFiles(): { name: string; path: string; mtime: number }[] {
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
export function cleanOldBackups() {
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
