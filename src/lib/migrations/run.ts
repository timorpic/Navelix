import type { DatabaseSync } from "node:sqlite";
import {
  generateStrongPassword,
  hashPassword,
  verifyPassword,
} from "../password.ts";
import { performDatabaseBackup } from "../db-backup.ts";
import { logger } from "../logger.ts";
import { ensureColumn, dropColumn, persistAdminPassword } from "./shared.ts";

/**
 * 全量迁移逻辑（v1~v12 与基础列补齐）。本模块由 index.ts 统一入口转发，
 * 内容从旧版单文件按字节迁移而来，完整保留其中的敏感字面量原值。
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
  ensureColumn(db, "users", "email", "email TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "users", "bio", "bio TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "sessions", "user_agent", "user_agent TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "sessions", "ip_address", "ip_address TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "sessions", "last_active_at", "last_active_at INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "notifications", "source", "source TEXT NOT NULL DEFAULT 'system'");

  db.exec(`
    CREATE TABLE IF NOT EXISTS api_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      token_prefix TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS user_category_subscriptions (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, category_id, owner_id)
    );
  `);
  ensureColumn(db, "user_categories", "is_team_shared", "is_team_shared INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "user_todos", "project_id", "project_id TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_todos", "assigned_to", "assigned_to TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_todos", "assignee_id", "assignee_id TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_todos", "assignee_name", "assignee_name TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "user_todos", "updated_at", "updated_at INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "projects", "description", "description TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "projects", "created_at", "created_at INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "projects", "updated_at", "updated_at INTEGER NOT NULL DEFAULT 0");
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
  ensureColumn(
    db,
    "user_configs",
    "link_open_target",
    "link_open_target TEXT NOT NULL DEFAULT '_blank'",
  );
  ensureColumn(
    db,
    "user_configs",
    "wallpaper_mode",
    "wallpaper_mode TEXT NOT NULL DEFAULT 'none'",
  );
  ensureColumn(
    db,
    "user_configs",
    "custom_wallpaper_url",
    "custom_wallpaper_url TEXT NOT NULL DEFAULT ''",
  );
  ensureColumn(
    db,
    "user_configs",
    "glassmorphism",
    "glassmorphism INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(
    db,
    "user_configs",
    "sidebar_default_state",
    "sidebar_default_state TEXT NOT NULL DEFAULT 'expanded'",
  );
  ensureColumn(
    db,
    "user_configs",
    "clock_widget_mode",
    "clock_widget_mode TEXT NOT NULL DEFAULT 'time'",
  );
  ensureColumn(
    db,
    "user_configs",
    "allow_public_access",
    "allow_public_access INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(
    db,
    "user_configs",
    "allow_registration",
    "allow_registration INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(
    db,
    "user_configs",
    "security_setup_done",
    "security_setup_done INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(
    db,
    "user_configs",
    "custom_head_scripts",
    "custom_head_scripts TEXT NOT NULL DEFAULT ''",
  );
  ensureColumn(
    db,
    "user_configs",
    "custom_css",
    "custom_css TEXT NOT NULL DEFAULT ''",
  );
  ensureColumn(db, "user_configs", "cliproxy_enabled", "cliproxy_enabled INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "user_configs", "cliproxy_url", "cliproxy_url TEXT NOT NULL DEFAULT 'http://127.0.0.1:8317'");
  ensureColumn(db, "user_configs", "cliproxy_key", "cliproxy_key TEXT NOT NULL DEFAULT ''");

  // 首次引入 security_setup_done 的存量部署：默认标记为已完成，避免打扰已在运行的老用户；
  // 全新部署（user_version=0）保持 0，首次登录对管理员展示安全设置引导横幅
  if (user_version > 0) {
    db.prepare("UPDATE user_configs SET security_setup_done = 1").run();
  }

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
          user_agent TEXT NOT NULL DEFAULT '',
          ip_address TEXT NOT NULL DEFAULT '',
          last_active_at INTEGER NOT NULL DEFAULT 0,
          expires_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        );
        INSERT OR IGNORE INTO sessions_new (token_hash, user_id, user_agent, ip_address, last_active_at, expires_at, created_at)
        SELECT token_hash, user_id, user_agent, ip_address, last_active_at, expires_at, created_at FROM sessions;
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
          is_team_shared INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (id, user_id)
        );
        INSERT OR IGNORE INTO user_categories_new (id, user_id, name, label, icon, color)
        SELECT id, user_id, name, label, icon, color FROM user_categories;
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
        INSERT OR IGNORE INTO user_links_new (id, user_id, title, url, description, icon, category, is_quick_access)
        SELECT id, user_id, title, url, description, icon, category, is_quick_access FROM user_links;
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
          cliproxy_enabled INTEGER NOT NULL DEFAULT 1,
          cliproxy_url TEXT NOT NULL DEFAULT 'http://[IP]:8317',
          cliproxy_key TEXT NOT NULL DEFAULT '',
          weather_enabled INTEGER NOT NULL DEFAULT 0,
          weather_api_key TEXT NOT NULL DEFAULT '',
          weather_location TEXT NOT NULL DEFAULT '',
          weather_api_base_url TEXT NOT NULL DEFAULT 'https://api.seniverse.com',
          link_open_target TEXT NOT NULL DEFAULT '_blank',
          wallpaper_mode TEXT NOT NULL DEFAULT 'none',
          custom_wallpaper_url TEXT NOT NULL DEFAULT '',
          glassmorphism INTEGER NOT NULL DEFAULT 0,
          sidebar_default_state TEXT NOT NULL DEFAULT 'expanded',
          clock_widget_mode TEXT NOT NULL DEFAULT 'time',
          allow_public_access INTEGER NOT NULL DEFAULT 0,
          allow_registration INTEGER NOT NULL DEFAULT 0,
          security_setup_done INTEGER NOT NULL DEFAULT 0,
          custom_head_scripts TEXT NOT NULL DEFAULT '',
          custom_css TEXT NOT NULL DEFAULT ''
        );
        INSERT OR IGNORE INTO user_configs_new (
          user_id, logo_text, logo_image, show_search_bar, max_width, custom_footer, language, theme, ai_base_url, ai_api_key, ai_model, site_title, link_status_enabled, link_status_interval, social_github, social_x, social_linkedin, social_email, cliproxy_enabled, cliproxy_url, cliproxy_key, weather_enabled, weather_api_key, weather_location, weather_api_base_url, link_open_target, wallpaper_mode, custom_wallpaper_url, glassmorphism, sidebar_default_state, clock_widget_mode, allow_public_access, allow_registration, security_setup_done, custom_head_scripts, custom_css
        )
        SELECT
          user_id, logo_text, logo_image, show_search_bar, max_width, custom_footer, language, theme, ai_base_url, ai_api_key, ai_model, site_title, link_status_enabled, link_status_interval, social_github, social_x, social_linkedin, social_email, cliproxy_enabled, cliproxy_url, cliproxy_key, weather_enabled, weather_api_key, weather_location, weather_api_base_url, link_open_target, wallpaper_mode, custom_wallpaper_url, glassmorphism, sidebar_default_state, clock_widget_mode, allow_public_access, allow_registration, security_setup_done, custom_head_scripts, custom_css
        FROM user_configs;
        DROP TABLE user_configs;
        ALTER TABLE user_configs_new RENAME TO user_configs;

        DROP TABLE IF EXISTS notifications_new;
        CREATE TABLE notifications_new (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          source TEXT NOT NULL DEFAULT 'system',
          created_at INTEGER NOT NULL,
          read INTEGER NOT NULL DEFAULT 0
        );
        INSERT OR IGNORE INTO notifications_new (id, user_id, title, content, source, created_at, read)
        SELECT id, user_id, title, content, source, created_at, read FROM notifications;
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
          description TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (id, user_id)
        );
        INSERT OR IGNORE INTO projects_new (id, user_id, name, status, status_color, url, description, created_at, updated_at, sort_order)
        SELECT id, user_id, name, status, status_color, url, description, created_at, updated_at, sort_order FROM projects;
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
          updated_at INTEGER NOT NULL DEFAULT 0,
          assignee_id TEXT NOT NULL DEFAULT '',
          assignee_name TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (id, user_id)
        );
        INSERT OR IGNORE INTO user_todos_new (id, user_id, title, priority, done, due_date, project_id, updated_at, assignee_id, assignee_name, created_at, sort_order)
        SELECT id, user_id, title, priority, done, due_date, project_id, updated_at, assignee_id, assignee_name, created_at, sort_order FROM user_todos;
        DROP TABLE user_todos;
        ALTER TABLE user_todos_new RENAME TO user_todos;
      `);

      db.exec("COMMIT;");
    } catch (err) {
      logger.error("v5 migration failed", {
        error: err instanceof Error ? err.message : err,
      });
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

  // ── v7：一次性自动迁移：为所有用户自动补齐“🖼️ 矢量插画库”分类与 8 大经典插画资源链接
  if (user_version < 7) {
    const userRows = db.prepare("SELECT id FROM users").all() as { id: string }[];
    const insertCat = db.prepare(`
      INSERT OR IGNORE INTO user_categories (id, user_id, name, label, icon, color)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertLink = db.prepare(`
      INSERT OR IGNORE INTO user_links (id, user_id, title, url, description, icon, category, is_quick_access)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const newCategory = { id: "illustrations", name: "矢量插画库", label: "插画", icon: "🖼️", color: "#00C776" };
    const newLinks = [
      { id: "undraw-link", title: "unDraw", url: "https://undraw.co/illustrations", description: "全球 UI 常用扁平矢量插画，在线实时一键换色", icon: "undraw", category: "illustrations", isQuickAccess: 1 },
      { id: "storyset-link", title: "Storyset", url: "https://storyset.com", description: "Freepik 旗下，支持在线编辑图层与制作动效", icon: "storyset", category: "illustrations", isQuickAccess: 1 },
      { id: "humaaans", title: "humaaans", url: "https://www.humaaans.com", description: "Pablo Stanley 打造的人形模块拼装插画库", icon: "humaaans", category: "illustrations", isQuickAccess: 0 },
      { id: "blush", title: "Blush", url: "https://blush.design", description: "全球多画师组件化拼装插画引擎，支持 Figma 插件", icon: "blush", category: "illustrations", isQuickAccess: 0 },
      { id: "ouch", title: "Icons8 Ouch!", url: "https://icons8.com/illustrations", description: "Icons8 出品，涵盖 3D/扁平/黏土/等距多风格插画", icon: "ouch", category: "illustrations", isQuickAccess: 0 },
      { id: "drawkit", title: "DrawKit", url: "https://drawkit.com", description: "矢量插画与 2D/3D 手绘素材资源包", icon: "drawkit", category: "illustrations", isQuickAccess: 0 },
      { id: "opendoodles", title: "Open Doodles", url: "https://www.opendoodles.com", description: "极简手绘涂鸦风插画库，带色彩生成器", icon: "opendoodles", category: "illustrations", isQuickAccess: 0 },
      { id: "isoflat", title: "IsoFlat", url: "https://isoflat.com", description: "2.5D 等距轴测矢量插画，适合科技与架构可视化", icon: "isoflat", category: "illustrations", isQuickAccess: 0 },
    ];

    for (const u of userRows) {
      try {
        insertCat.run(newCategory.id, u.id, newCategory.name, newCategory.label, newCategory.icon, newCategory.color);
        for (const l of newLinks) {
          insertLink.run(l.id, u.id, l.title, l.url, l.description, l.icon, l.category, l.isQuickAccess);
        }
      } catch {
        // Skip orphan users if deleted concurrently
      }
    }
    db.exec("PRAGMA user_version = 7");
  }

  // ── v8：更新 UI 设计图标库的描述说明，包含中文友好/商用授权提示
  if (user_version < 8) {
    const iconUpdates: Array<{ id: string; desc: string }> = [
      { id: "iconpark-cat", desc: "字节开源图标库，完全免费商用，线性/面性/双色，可调描边圆角" },
      { id: "iconfont", desc: "阿里矢量图标库，海量资源、支持改色与团队库（需注意筛选免费商用标签）" },
      { id: "qingicon", desc: "国产 B 端开源图标库，适合后台管理系统，提供 Figma 插件" },
      { id: "material-symbols", desc: "Google 官方可变矢量图标库，开源免费商用，跨端项目友好" },
      { id: "tabler-icons", desc: "5000+ 干净线性图标，B 端与 SaaS 后台首选，开源免费商用" },
      { id: "iconoir", desc: "圆润柔和开源图标库，年轻化风格，适合消费类 App" },
    ];
    const updateStmt = db.prepare("UPDATE user_links SET description = ? WHERE id = ?");
    for (const u of iconUpdates) {
      updateStmt.run(u.desc, u.id);
    }
    db.exec("PRAGMA user_version = 8");
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

  // ── v9：一次性自动清理历史遗留测试账号
  if (user_version < 9) {
    db.prepare("DELETE FROM users WHERE username LIKE 'tokuser_%' OR username LIKE 'test-%' OR id LIKE 'user_token_test_%' OR id LIKE 'test-%'").run();
    db.exec("PRAGMA user_version = 9");
  }

  // ── v10：删除已废弃的外部搜索引擎配置列（首页搜索已改为仅系统内搜索）
  if (user_version < 10) {
    dropColumn(db, "user_configs", "search_engine");
    dropColumn(db, "user_configs", "custom_search_name");
    dropColumn(db, "user_configs", "custom_search_url");
    db.exec("PRAGMA user_version = 10");
  }

  // ── v11：删除已废弃的商汤 SenseNova 模型用量监控配置列（首页面板与后台配置均已移除）
  if (user_version < 11) {
    // 破坏性结构变更前自动生成物理热备份，确保已部署库凭据数据可回滚
    performDatabaseBackup("migration-v11");
    dropColumn(db, "user_configs", "sensenova_enabled");
    dropColumn(db, "user_configs", "sensenova_username");
    dropColumn(db, "user_configs", "sensenova_password");
    dropColumn(db, "user_configs", "sensenova_account_id");
    dropColumn(db, "user_configs", "sensenova_token_key");
    db.exec("PRAGMA user_version = 11");
  }

  // ── v12：新增模型账号表（反重力 / Codex OAuth 账号与额度缓存）
  if (user_version < 12) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS model_accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        email TEXT NOT NULL DEFAULT '',
        label TEXT NOT NULL DEFAULT '',
        access_token_enc TEXT NOT NULL DEFAULT '',
        refresh_token_enc TEXT NOT NULL DEFAULT '',
        id_token_enc TEXT NOT NULL DEFAULT '',
        token_expires_at INTEGER NOT NULL DEFAULT 0,
        plan_type TEXT NOT NULL DEFAULT '',
        subscription_start TEXT NOT NULL DEFAULT '',
        subscription_until TEXT NOT NULL DEFAULT '',
        credits_amount REAL,
        min_credit_amount REAL,
        credits_known INTEGER NOT NULL DEFAULT 0,
        last_error TEXT NOT NULL DEFAULT '',
        last_checked_at INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_model_accounts_user
        ON model_accounts(user_id, provider);
    `);
    db.exec("PRAGMA user_version = 12");
  }

  // ── v12 之后：model_accounts 新增反重力项目 ID 与额度窗口缓存列
  // ── user_configs 新增前台侧边栏模型监控显示开关
  ensureColumn(db, "model_accounts", "project_id", "project_id TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "model_accounts", "quota_summary", "quota_summary TEXT NOT NULL DEFAULT ''");
  ensureColumn(
    db,
    "user_configs",
    "model_monitor_enabled",
    "model_monitor_enabled INTEGER NOT NULL DEFAULT 1",
  );

  // 通知数据自动清理：保留 30 天内的操作记录，避免数据库无限制膨胀
  db.prepare(
    "DELETE FROM notifications WHERE created_at < ?",
  ).run(Date.now() - 30 * 24 * 60 * 60 * 1000);
}
