import { writeLog } from "../logging/events.ts";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * 旧版本数据库自动迁移：
 * 早期版本主库名为 nexus.db，重命名为 navelix.db 后，已部署实例的挂载卷
 * 里只有 nexus.db。首次启动时若发现新库不存在而旧库存在，自动迁移。
 * 1) 优先用 VACUUM INTO 生成干净的新库（含 WAL 中已提交数据，无残留日志依赖）；
 * 2) 失败则回退为文件重命名（连同 -wal/-shm）。
 * 迁移完成后保留旧文件作为备份，确认无误后可手动删除。
 */
export function migrateLegacyDatabase(
  dataDir: string,
  dbFile: string,
): void {
  const legacyFile = path.join(dataDir, "nexus.db");
  if (!fs.existsSync(legacyFile)) return;
  if (fs.existsSync(dbFile)) return;

  try {
    const legacyDb = new DatabaseSync(legacyFile);
    legacyDb.exec("PRAGMA busy_timeout = 5000;");
    legacyDb.exec(`VACUUM INTO '${dbFile.replace(/'/g, "''")}'`);
    legacyDb.close();
    writeLog({ category: "runtime", event: "database.legacy.migrated" });
    return;
  } catch {
    writeLog({ category: "runtime", event: "database.legacy.fallback", level: "warn", outcome: "failed" });
  }

  try {
    fs.renameSync(legacyFile, dbFile);
    for (const ext of ["-wal", "-shm"]) {
      const src = legacyFile + ext;
      // 旧库的 WAL/SHM 来自运行期挂载卷，不应追踪进 standalone 产物。
      if (fs.existsSync(/*turbopackIgnore: true*/ src)) {
        try {
          fs.renameSync(src, dbFile + ext);
        } catch {
          // 忽略：WAL/SHM 可缺失或被 SQLite 自动重建
        }
      }
    }
    writeLog({ category: "runtime", event: "database.legacy.renamed" });
  } catch {
    writeLog({ category: "runtime", event: "database.legacy.failed", level: "error", outcome: "failed" });
  }
}
