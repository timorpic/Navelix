import type { DatabaseSync } from "node:sqlite";

/**
 * v2：一次性迁移 —— 将仍为旧版 7 个默认分类的用户收敛到新的 3 个内置分类。
 */
export function migrateV2(db: DatabaseSync): void {
  const oldDefaultIds = [
    "ai",
    "design",
    "dev",
    "productivity",
    "learning",
    "resources",
    "favorites",
  ].sort();
  const removedIds = ["productivity", "learning", "resources", "favorites"];

  const users = db.prepare("SELECT DISTINCT user_id FROM user_categories").all() as {
    user_id: string;
  }[];

  for (const { user_id } of users) {
    const ids = (
      db
        .prepare("SELECT id FROM user_categories WHERE user_id = ?")
        .all(user_id) as { id: string }[]
    )
      .map((r) => r.id)
      .sort();
    if (JSON.stringify(ids) !== JSON.stringify(oldDefaultIds)) continue;

    db.prepare(
      `DELETE FROM user_links
       WHERE user_id = ? AND category IN (?, ?, ?, ?)`,
    ).run(user_id, ...removedIds);
    db.prepare(
      `DELETE FROM user_categories
       WHERE user_id = ? AND id IN (?, ?, ?, ?)`,
    ).run(user_id, ...removedIds);

    db.prepare(
      "UPDATE user_categories SET name = 'AI 工具', label = 'AI', icon = '🤖' WHERE user_id = ? AND id = 'ai'",
    ).run(user_id);
    db.prepare(
      "UPDATE user_categories SET name = 'Design', label = 'Des', icon = '🎨' WHERE user_id = ? AND id = 'design'",
    ).run(user_id);
    db.prepare(
      "UPDATE user_categories SET name = '开发工具', label = '开发', icon = '💻' WHERE user_id = ? AND id = 'dev'",
    ).run(user_id);
  }
}