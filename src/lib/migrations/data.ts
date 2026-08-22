import type { DatabaseSync } from "node:sqlite";
import {
  generateStrongPassword,
  hashPassword,
  verifyPassword,
} from "../password.ts";
import { persistAdminPassword } from "./shared.ts";
import { DEFAULT_CUSTOM_FOOTER } from "../constants.ts";

/**
 * 非版本化的始终执行数据修复与初装引导。
 * 版本化迁移见 ./versions/（v1~v12，结构与业务数据分离）。
 */

/**
 * 初装引导：没有任何用户时创建默认 admin（弱密码轮换 v3 依赖它先存在）。
 */
export function seedAdminIfEmpty(db: DatabaseSync): void {
  const userCount = (db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c;
  if (userCount !== 0) return;

  const seedPassword = process.env.NAVELIX_ADMIN_PASSWORD || generateStrongPassword();
  db.prepare(`
    INSERT OR IGNORE INTO users (id, username, password_hash, display_name, role, avatar, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run("admin-001", "admin", hashPassword(seedPassword), "Navelix Admin", "admin", "", Date.now());

  if (!process.env.NAVELIX_ADMIN_PASSWORD) {
    // 并发场景下确认最终落库的确实是本次生成的密码后再写提示文件，
    // 避免多 worker 各自生成不同密码导致文件与库不一致
    const after = db
      .prepare("SELECT password_hash FROM users WHERE username = 'admin'")
      .get() as { password_hash: string } | undefined;
    if (after && verifyPassword(seedPassword, after.password_hash)) {
      persistAdminPassword(seedPassword);
    }
  }
}

/**
 * 始终执行的幂等数据修复（无版本号）：
 * - 品牌文案 Nexus → Navelix 迁移（用户自定义过的值不受影响）
 * - Lucide 风格分类图标 → emoji 约定迁移
 * - 通知数据自动清理：保留 30 天内记录，避免数据库无限制膨胀
 */
export function applyAlwaysDataFixes(db: DatabaseSync): void {
  db.prepare("UPDATE user_configs SET logo_text = 'Navelix' WHERE logo_text = 'Nexus'").run();
  db.prepare(
    "UPDATE user_configs SET custom_footer = ? WHERE custom_footer = ?",
  ).run(DEFAULT_CUSTOM_FOOTER, "© 2026 Nexus. 保留所有权利。");

  const ICON_MIGRATIONS: Record<string, string> = {
    Bot: "🤖",
    Palette: "🎨",
    Code2: "💻",
    Zap: "⚡",
    BookOpen: "📚",
    Layers: "📦",
    Star: "⭐",
  };
  const migrateIcon = db.prepare(
    "UPDATE user_categories SET icon = ? WHERE icon = ?",
  );
  for (const [from, to] of Object.entries(ICON_MIGRATIONS)) {
    migrateIcon.run(to, from);
  }

  db.prepare(
    "DELETE FROM notifications WHERE created_at < ?",
  ).run(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

/**
 * 存量部署安全设置引导：首次引入 security_setup_done 的存量库默认标记为已完成，
 * 避免打扰已在运行的老用户；全新部署（user_version=0）保持 0，首次登录展示引导横幅。
 */
export function backfillSecuritySetupDone(db: DatabaseSync, userVersion: number): void {
  if (userVersion > 0) {
    db.prepare("UPDATE user_configs SET security_setup_done = 1").run();
  }
}