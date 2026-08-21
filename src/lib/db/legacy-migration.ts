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
    console.log(
      "[Navelix] 检测到旧版数据库，已自动迁移 nexus.db → navelix.db（旧文件已保留，可手动删除）",
    );
    return;
  } catch (err) {
    console.error(
      "[Navelix] 旧库 VACUUM INTO 迁移失败，尝试文件重命名回退:",
      err instanceof Error ? err.message : err,
    );
  }

  try {
    fs.renameSync(legacyFile, dbFile);
    for (const ext of ["-wal", "-shm"]) {
      const src = legacyFile + ext;
      if (fs.existsSync(src)) {
        try {
          fs.renameSync(src, dbFile + ext);
        } catch {
          // 忽略：WAL/SHM 可缺失或被 SQLite 自动重建
        }
      }
    }
    console.log(
      "[Navelix] 已通过文件重命名完成 nexus.db → navelix.db 迁移",
    );
  } catch (err) {
    console.error("[Navelix] 旧数据库迁移失败:", err);
  }
}
