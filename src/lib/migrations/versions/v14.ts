import type { DatabaseSync } from "node:sqlite";

/**
 * v14：为「全站配置单例 + 个人偏好分离」建立锚点。
 *
 * 背景：user_configs 此前「每 user_id 一行」，但其中一部分字段（品牌/AI/天气/社交/
 * 安全策略/代码注入/探针/页脚）是全站级，读路径却分散指向「最早 admin / 当前用户」，
 * 多 admin 下改完不生效、各 admin 看到不一致。v14 起这些全站级字段统一收敛到
 * system_settings['global_config_user_id'] 锚定的单例行（以最早 admin 行为源），
 * 个人偏好字段仍各 user 一行。
 *
 * 本迁移**只写锚点，不删任何行**：个人偏好按 user 保留，全站字段以最早 admin 行为准
 * （这正是此前注册/公开访问/AI/天气/遥测的读取口径，数据零丢失）。
 * 幂等：锚点 upsert，重复执行无副作用。
 */
export function migrateV14(db: DatabaseSync): void {
  const owner = db
    .prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1")
    .get() as { id: string } | undefined;
  if (!owner) return; // 空库：等首个 admin 出现后由 resolveGlobalConfigOwnerId 惰性锚定

  // 确保最早 admin 有一行配置（承载全站字段，其余列走元数据默认值）
  // 构建与启动可能由多个进程同时执行迁移，不能使用“先查再插”的竞态写法。
  db.prepare("INSERT OR IGNORE INTO user_configs (user_id) VALUES (?)").run(owner.id);

  // 写入锚点（幂等 upsert）
  db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES ('global_config_user_id', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(owner.id, Date.now());
}
