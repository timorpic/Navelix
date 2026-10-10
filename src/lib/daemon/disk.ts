import fs from "node:fs";
import path from "node:path";
import { sendTelegramNotification } from "../telegram.ts";
import { isTelegramNotifySystemEnabled } from "../system-settings.ts";
import { resolveDataDir } from "../data-dir.ts";

/**
 * 磁盘占用与 SQLite WAL 膨胀巡检（阈值告警）。
 *
 * 从 `daemon.ts` 拆出，见 `daemon/maintenance.ts` 的说明。
 * 这两个任务的共同点是：只读文件系统、只发告警、失败静默。
 */

const DATA_DIR = resolveDataDir();

/** 字节数格式化为 MB 字符串 */
function mb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    const backupDir = path.join(DATA_DIR, "backups");

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

    const dataSize = dirSize(DATA_DIR);
    const backupSize = dirSize(backupDir);

    if (dataSize > 2 * 1024 * 1024 * 1024) {
      sendTelegramNotification(
        `⚠️ Navelix 数据目录占用过高\n\ndata/ 目录：${mb(dataSize)}\n请及时清理无用数据。`,
        isTelegramNotifySystemEnabled(),
      ).catch(() => {});
    }
    if (backupSize > 1024 * 1024 * 1024) {
      sendTelegramNotification(
        `⚠️ Navelix 备份目录占用过高\n\nbackups/ 目录：${mb(backupSize)}\n请及时清理旧备份。`,
        isTelegramNotifySystemEnabled(),
      ).catch(() => {});
    }
  } catch {
    // 磁盘检查失败不影响主流程
  }
}
