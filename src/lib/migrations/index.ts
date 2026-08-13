import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import {
  generateStrongPassword,
  hashPassword,
  verifyPassword,
} from "../password.ts";

/**
 * 数据库迁移模块：承载所有 Schema 版本迁移（v1 ~ v6）与一次性数据修复。
 *
 * 所有权归 db.ts 的 runMigrations(db) 调用，在数据库连接建立、表结构创建后执行。
 * 通过 PRAGMA user_version 记录当前 Schema 版本；迁移按顺序执行，幂等可重入。
 *
 * 注意：user_version 在启动时读取一次快照，与旧实现语义一致——
 * 一次启动中可连续执行多个未应用的版本迁移。
 */

export const DATA_DIR = path.join(process.cwd(), "data");

/**
 * 记录初始管理员密码（首次生成/轮换时写入 data/ 目录，目录已被 gitignore）
 */
function persistAdminPassword(password: string) {
  const file = path.join(DATA_DIR, "navelix-admin-password.txt");
  try {
    fs.writeFileSync(
      file,
      `Navelix 管理员初始密码（请登录后立即修改，并删除本文件）\n\n用户名: admin\n密码: ${password}\n`,
      "utf8",
    );
  } catch {
    // ignore
  }
  console.warn(
    `[Navelix] 管理员 admin 的初始密码为: ${password}\n请登录后立即修改，并删除 data/navelix-admin-password.txt 文件。`,
  );
}

/**
 * 为旧库补齐缺失列（首次升级时执行）。
 * 说明：Next.js build 会启动多个 worker 加载此模块，两个 worker 同时
 * ALTER TABLE 时，后到者会得到 "duplicate column name"——捕获并安全忽略。
 */
function ensureColumn(
  db: DatabaseSync,
  table: string,
  column: string,
  definition: string,
) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  if (!columns.some((c) => c.name === column)) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("duplicate column")) {
        // Another worker beat us to it — nothing to do.
      } else {
        throw e;
      }
    }
  }
}

/**
 * 执行全部 Schema 迁移与一次性数据修复。
 * 须在 db.ts 完成 CREATE TABLE 之后调用。
 */
export function runMigrations(db: DatabaseSync): void {
  // 启动时版本快照：与旧实现一致，一次启动可连续应用多个版本升级
  const { user_version } = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };

  // ── Migrations for databases created before the AI config columns existed ──
  ensureColumn(
    db,
    "user_configs",
    "ai_base_url",
    "ai_base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1'",
  );
  ensureColumn(db, "user_configs", "ai_api_key", "ai_api_key TEXT NOT NULL DEFAULT ''");
  ensureColumn(
    db,
    "user_configs",
    "ai_model",
    "ai_model TEXT NOT NULL DEFAULT 'gpt-4o-mini'",
  );
  ensureColumn(db, "user_configs", "social_github", "social_github TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_configs", "social_x", "social_x TEXT NOT NULL DEFAULT ''");
  ensureColumn(
    db,
    "user_configs",
    "social_linkedin",
    "social_linkedin TEXT NOT NULL DEFAULT ''",
  );
  ensureColumn(
    db,
    "user_configs",
    "social_email",
    "social_email TEXT NOT NULL DEFAULT ''",
  );
  ensureColumn(db, "users", "avatar", "avatar TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_todos", "project_id", "project_id TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_configs", "logo_image", "logo_image TEXT NOT NULL DEFAULT ''");
  ensureColumn(
    db,
    "user_configs",
    "site_title",
    "site_title TEXT NOT NULL DEFAULT 'Navelix · Personal Digital Hub'",
  );
  ensureColumn(
    db,
    "user_configs",
    "link_status_enabled",
    "link_status_enabled INTEGER NOT NULL DEFAULT 1",
  );
  ensureColumn(
    db,
    "user_configs",
    "link_status_interval",
    "link_status_interval INTEGER NOT NULL DEFAULT 60",
  );
  ensureColumn(db, "user_configs", "weather_enabled", "weather_enabled INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "user_configs", "weather_api_key", "weather_api_key TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_configs", "weather_location", "weather_location TEXT NOT NULL DEFAULT ''");
  ensureColumn(
    db,
    "user_configs",
    "weather_api_base_url",
    "weather_api_base_url TEXT NOT NULL DEFAULT 'https://api.seniverse.com'",
  );

  // ── v1：一次性迁移：为旧库中已有的用户配置补上社交链接默认值（仅在首次升级时执行，
  //     之后用户在后台清空字段即为"隐藏"语义，不会被再次覆盖）
  if (user_version < 1) {
    db.prepare(`
      UPDATE user_configs SET
        social_github = CASE WHEN social_github = '' THEN ? ELSE social_github END,
        social_x = CASE WHEN social_x = '' THEN ? ELSE social_x END,
        social_linkedin = CASE WHEN social_linkedin = '' THEN ? ELSE social_linkedin END,
        social_email = CASE WHEN social_email = '' THEN ? ELSE social_email END
    `).run(
      "https://github.com",
      "https://x.com",
      "https://linkedin.com",
      "[邮箱]",
    );
    db.exec("PRAGMA user_version = 1");
  }

  // ── v2：一次性迁移：将仍为旧版 7 个默认分类的用户收敛到新的 3 个内置分类
  if (user_version < 2) {
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

    db.exec("PRAGMA user_version = 2");
  }

  // ── Seed default admin user if database is fresh ──
  // 注意：该初始化逻辑位于 v3 弱密码轮换之前，保证 v3 可以基于已存在的 admin 执行
  const userCount = (db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c;
  if (userCount === 0) {
    const seedPassword =
      process.env.NAVELIX_ADMIN_PASSWORD || generateStrongPassword();

    db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, display_name, role, avatar, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run("admin-001", "admin", hashPassword(seedPassword), "Navelix Admin", "admin", "", Date.now());

    if (!process.env.NAVELIX_ADMIN_PASSWORD) {
      persistAdminPassword(seedPassword);
    }
  }

  // ── v3：轮换旧版本遗留的默认弱密码 admin123（仅升级时执行一次）
  if (user_version < 3) {
    const adminRow = db
      .prepare(
        "SELECT id, username, password_hash FROM users WHERE username = 'admin' AND role = 'admin'",
      )
      .get() as { id: string; password_hash: string } | undefined;
    if (adminRow && verifyPassword("admin123", adminRow.password_hash)) {
      const newPassword =
        process.env.NAVELIX_ADMIN_PASSWORD || generateStrongPassword();
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
        hashPassword(newPassword),
        adminRow.id,
      );
      // 并发场景下确认最终落库的确实是本次生成的密码后再写提示文件
      const after = db
        .prepare("SELECT password_hash FROM users WHERE id = ?")
        .get(adminRow.id) as { password_hash: string } | undefined;
      if (after && verifyPassword(newPassword, after.password_hash)) {
        persistAdminPassword(newPassword);
      }
    }
    db.exec("PRAGMA user_version = 3");
  }

  // ── v5：重建表，为所有数据表补齐外键约束与级联删除
  if (user_version < 5) {
    try {
      db.exec("PRAGMA foreign_keys = OFF;");
      db.exec("BEGIN TRANSACTION;");

      db.exec(`
        DROP TABLE IF EXISTS sessions_new;
        CREATE TABLE sessions_new (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        );
        INSERT OR IGNORE INTO sessions_new SELECT * FROM sessions;
        DROP TABLE sessions;
        ALTER TABLE sessions_new RENAME TO sessions;

        DROP TABLE IF EXISTS user_categories_new;
        CREATE TABLE user_categories_new (
          id TEXT NOT NULL,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          label TEXT NOT NULL,
          icon TEXT NOT NULL,
          color TEXT NOT NULL,
          PRIMARY KEY (id, user_id)
        );
        INSERT OR IGNORE INTO user_categories_new SELECT * FROM user_categories;
        DROP TABLE user_categories;
        ALTER TABLE user_categories_new RENAME TO user_categories;

        DROP TABLE IF EXISTS user_links_new;
        CREATE TABLE user_links_new (
          id TEXT NOT NULL,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          url TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          icon TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL,
          is_quick_access INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (id, user_id)
        );
        INSERT OR IGNORE INTO user_links_new SELECT * FROM user_links;
        DROP TABLE user_links;
        ALTER TABLE user_links_new RENAME TO user_links;

        DROP TABLE IF EXISTS user_configs_new;
        CREATE TABLE user_configs_new (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          logo_text TEXT NOT NULL DEFAULT 'Navelix',
          logo_image TEXT NOT NULL DEFAULT '',
          show_search_bar INTEGER NOT NULL DEFAULT 1,
          max_width TEXT NOT NULL DEFAULT '1200px',
          custom_footer TEXT NOT NULL DEFAULT '© 2026 Navelix. 保留所有权利。',
          language TEXT NOT NULL DEFAULT 'zh',
          theme TEXT NOT NULL DEFAULT 'light',
          search_engine TEXT NOT NULL DEFAULT 'google',
          ai_base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
          ai_api_key TEXT NOT NULL DEFAULT '',
          ai_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
          site_title TEXT NOT NULL DEFAULT 'Navelix · Personal Digital Hub',
          link_status_enabled INTEGER NOT NULL DEFAULT 1,
          link_status_interval INTEGER NOT NULL DEFAULT 60,
          social_github TEXT NOT NULL DEFAULT '',
          social_x TEXT NOT NULL DEFAULT '',
          social_linkedin TEXT NOT NULL DEFAULT '',
          social_email TEXT NOT NULL DEFAULT '',
          weather_enabled INTEGER NOT NULL DEFAULT 0,
          weather_api_key TEXT NOT NULL DEFAULT '',
          weather_location TEXT NOT NULL DEFAULT '',
          weather_api_base_url TEXT NOT NULL DEFAULT 'https://api.seniverse.com'
        );
        INSERT OR IGNORE INTO user_configs_new (
          user_id, logo_text, logo_image, show_search_bar, max_width, custom_footer, language, theme, search_engine, ai_base_url, ai_api_key, ai_model, site_title, link_status_enabled, link_status_interval, social_github, social_x, social_linkedin, social_email, weather_enabled, weather_api_key, weather_location, weather_api_base_url
        )
        SELECT
          user_id, logo_text, logo_image, show_search_bar, max_width, custom_footer, language, theme, search_engine, ai_base_url, ai_api_key, ai_model, site_title, link_status_enabled, link_status_interval, social_github, social_x, social_linkedin, social_email, weather_enabled, weather_api_key, weather_location, weather_api_base_url
        FROM user_configs;
        DROP TABLE user_configs;
        ALTER TABLE user_configs_new RENAME TO user_configs;

        DROP TABLE IF EXISTS notifications_new;
        CREATE TABLE notifications_new (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          read INTEGER NOT NULL DEFAULT 0
        );
        INSERT OR IGNORE INTO notifications_new SELECT * FROM notifications;
        DROP TABLE notifications;
        ALTER TABLE notifications_new RENAME TO notifications;

        DROP TABLE IF EXISTS projects_new;
        CREATE TABLE projects_new (
          id TEXT NOT NULL,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          status TEXT NOT NULL,
          status_color TEXT NOT NULL DEFAULT '',
          url TEXT NOT NULL DEFAULT '',
          sort_order INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (id, user_id)
        );
        INSERT OR IGNORE INTO projects_new SELECT * FROM projects;
        DROP TABLE projects;
        ALTER TABLE projects_new RENAME TO projects;

        DROP TABLE IF EXISTS user_todos_new;
        CREATE TABLE user_todos_new (
          id TEXT NOT NULL,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          priority TEXT NOT NULL DEFAULT 'medium',
          done INTEGER NOT NULL DEFAULT 0,
          due_date TEXT NOT NULL DEFAULT '',
          project_id TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (id, user_id)
        );
        INSERT OR IGNORE INTO user_todos_new SELECT * FROM user_todos;
        DROP TABLE user_todos;
        ALTER TABLE user_todos_new RENAME TO user_todos;
      `);

      db.exec("COMMIT;");
    } catch {
      try { db.exec("ROLLBACK;"); } catch {}
    } finally {
      db.exec("PRAGMA foreign_keys = ON;");
    }
    db.exec("PRAGMA user_version = 5");
  }

  // ── v6：一次性自动修复：清理并重置旧版本 SELECT * 引起的 user_configs 列错位
  if (user_version < 6) {
    const rows = db.prepare("SELECT * FROM user_configs").all() as Record<string, unknown>[];
    for (const r of rows) {
      if (
        typeof r.show_search_bar === "string" ||
        typeof r.theme !== "string" ||
        !["light", "dark", "system"].includes(String(r.theme))
      ) {
        db.prepare(`
          UPDATE user_configs SET
            logo_text = 'Navelix',
            logo_image = '',
            show_search_bar = 1,
            max_width = '1200px',
            custom_footer = '© 2026 Navelix. 保留所有权利。',
            theme = 'system',
            search_engine = 'google',
            ai_base_url = 'https://api.openai.com/v1',
            ai_model = 'gpt-4o-mini',
            site_title = 'Navelix · Personal Digital Hub',
            link_status_enabled = 1,
            link_status_interval = 60,
            social_github = '',
            social_x = '',
            social_linkedin = '',
            social_email = '',
            weather_enabled = 0,
            weather_api_key = '',
            weather_location = '',
            weather_api_base_url = 'https://api.seniverse.com'
          WHERE user_id = ?
        `).run(r.user_id as string);
      }
    }
    db.exec("PRAGMA user_version = 6");
  }

  // 将旧版本默认品牌文案迁移到 Navelix（用户自定义过的值不受影响）
  db.prepare("UPDATE user_configs SET logo_text = 'Navelix' WHERE logo_text = 'Nexus'").run();
  db.prepare(
    "UPDATE user_configs SET custom_footer = ? WHERE custom_footer = ?",
  ).run("© 2026 Navelix. 保留所有权利。", "© 2026 Nexus. 保留所有权利。");

  // Migrate legacy Lucide-style category icons to the emoji convention used by the UI.
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

  // 通知数据自动清理：保留 30 天内的操作记录，避免数据库无限制膨胀
  db.prepare(
    "DELETE FROM notifications WHERE created_at < ?",
  ).run(Date.now() - 30 * 24 * 60 * 60 * 1000);
}