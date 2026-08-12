import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import {
  generateStrongPassword,
  hashPassword,
  verifyPassword,
} from "./password";
import {
  categories as seedCategories,
  seedQuickAccess,
  siteLinks as seedLinks,
} from "@/data/links";

// Server-only module: never import from client components.

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const db = new DatabaseSync(path.join(DATA_DIR, "nexus.db"));

// The module runs inside multiple Next.js build workers.
// 1) Set busy_timeout FIRST (it's a per-connection setting, no write lock needed),
//    so concurrent workers wait for the lock instead of failing immediately.
// 2) Then switch to WAL mode. This needs a write lock on the DB file header;
//    if another worker is already doing it, we get "database is locked" — ignore it,
//    since WAL mode is already active (or will be set by the winner).
db.exec("PRAGMA busy_timeout = 5000;");
try {
  db.exec("PRAGMA journal_mode = WAL;");
} catch (e: unknown) {
  if (e instanceof Error && e.message.includes("locked")) {
    // Another worker beat us to switching to WAL — safe to proceed.
  } else {
    throw e;
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'user',
    avatar TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_categories (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    label TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    PRIMARY KEY (id, user_id)
  );

  CREATE TABLE IF NOT EXISTS user_links (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    is_quick_access INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, user_id)
  );

  CREATE TABLE IF NOT EXISTS user_configs (
    user_id TEXT PRIMARY KEY,
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
    social_email TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    read INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    status_color TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, user_id)
  );

  CREATE TABLE IF NOT EXISTS user_todos (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    done INTEGER NOT NULL DEFAULT 0,
    due_date TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, user_id)
  );
`);

// Migrations for databases created before the AI config columns existed.
// Note: Next.js build spawns multiple workers that all load this module.
// If two workers race on the same ALTER TABLE, the second one gets
// "duplicate column name" — we catch and ignore that safely.
function ensureColumn(table: string, column: string, definition: string) {
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

ensureColumn(
  "user_configs",
  "ai_base_url",
  "ai_base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1'",
);
ensureColumn("user_configs", "ai_api_key", "ai_api_key TEXT NOT NULL DEFAULT ''");
ensureColumn(
  "user_configs",
  "ai_model",
  "ai_model TEXT NOT NULL DEFAULT 'gpt-4o-mini'",
);
ensureColumn("user_configs", "social_github", "social_github TEXT NOT NULL DEFAULT ''");
ensureColumn("user_configs", "social_x", "social_x TEXT NOT NULL DEFAULT ''");
ensureColumn(
  "user_configs",
  "social_linkedin",
  "social_linkedin TEXT NOT NULL DEFAULT ''",
);
ensureColumn(
  "user_configs",
  "social_email",
  "social_email TEXT NOT NULL DEFAULT ''",
);
ensureColumn("users", "avatar", "avatar TEXT NOT NULL DEFAULT ''");
ensureColumn("user_todos", "project_id", "project_id TEXT NOT NULL DEFAULT ''");
ensureColumn("user_configs", "logo_image", "logo_image TEXT NOT NULL DEFAULT ''");
ensureColumn(
  "user_configs",
  "site_title",
  "site_title TEXT NOT NULL DEFAULT 'Navelix · Personal Digital Hub'",
);
ensureColumn(
  "user_configs",
  "link_status_enabled",
  "link_status_enabled INTEGER NOT NULL DEFAULT 1",
);
ensureColumn(
  "user_configs",
  "link_status_interval",
  "link_status_interval INTEGER NOT NULL DEFAULT 60",
);
ensureColumn("user_configs", "weather_enabled", "weather_enabled INTEGER NOT NULL DEFAULT 0");
ensureColumn("user_configs", "weather_api_key", "weather_api_key TEXT NOT NULL DEFAULT ''");
ensureColumn("user_configs", "weather_location", "weather_location TEXT NOT NULL DEFAULT ''");
ensureColumn(
  "user_configs",
  "weather_api_base_url",
  "weather_api_base_url TEXT NOT NULL DEFAULT 'https://api.seniverse.com'",
);

// 一次性迁移：为旧库中已有的用户配置补上社交链接默认值（仅在首次升级时执行，
// 之后用户在后台清空字段即为"隐藏"语义，不会被再次覆盖）。
const { user_version } = db.prepare("PRAGMA user_version").get() as {
  user_version: number;
};
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
    "you@example.com",
  );
  db.exec("PRAGMA user_version = 1");
}

// 一次性迁移：将仍为旧版 7 个默认分类的用户收敛到新的 3 个内置分类
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

// 记录初始管理员密码（首次生成/轮换时写入 data/ 目录，目录已被 gitignore）
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

// Seed default admin user if database is fresh
const userCount = (db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c;
if (userCount === 0) {
  const seedPassword =
    process.env.NAVELIX_ADMIN_PASSWORD || generateStrongPassword();

  db.prepare(`
    INSERT OR IGNORE INTO users (id, username, password_hash, display_name, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run("admin-001", "admin", hashPassword(seedPassword), "Navelix Admin", "admin", Date.now());

  if (!process.env.NAVELIX_ADMIN_PASSWORD) {
    persistAdminPassword(seedPassword);
  }
}

// 轮换旧版本遗留的默认弱密码 admin123（仅升级时执行一次）
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

// Seed user starter categories and links ONLY ONCE on initial user creation
export function seedUserData(userId: string) {
  const configExists = db
    .prepare("SELECT 1 FROM user_configs WHERE user_id = ?")
    .get(userId);

  // 如果用户已经进行过初始化（已存在配置记录），绝对不要重复 re-seed 覆盖用户数据
  if (configExists) {
    return;
  }

  const insertCat = db.prepare(`
    INSERT OR REPLACE INTO user_categories (id, user_id, name, label, icon, color)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const c of seedCategories) {
    insertCat.run(c.id, userId, c.name, c.label, c.icon, c.color);
  }

  const insertLink = db.prepare(`
    INSERT OR REPLACE INTO user_links (id, user_id, title, url, description, icon, category, is_quick_access)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const mergedLinks = [...seedLinks];
  for (const q of seedQuickAccess) {
    const existingIndex = mergedLinks.findIndex(
      (l) => l.url.toLowerCase() === q.url.toLowerCase(),
    );
    if (existingIndex >= 0) {
      const existing = mergedLinks[existingIndex];
      mergedLinks[existingIndex] = {
        ...existing,
        isQuickAccess: true,
        icon: existing.icon || q.icon,
      };
    } else {
      mergedLinks.push(q);
    }
  }

  for (const l of mergedLinks) {
    insertLink.run(
      l.id,
      userId,
      l.title,
      l.url,
      l.description,
      l.icon,
      l.category,
      l.isQuickAccess ? 1 : 0,
    );
  }

  const insertProject = db.prepare(`
    INSERT OR REPLACE INTO projects (id, user_id, name, status, status_color, url, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const defaults = [
    {
      id: "p1",
      name: "IT 运维管家官网",
      status: "进行中",
      statusColor:
        "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900",
      url: "https://github.com",
    },
    {
      id: "p2",
      name: "AI Memory Architecture",
      status: "研究中",
      statusColor:
        "bg-sky-50 text-sky-600 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-900",
      url: "https://github.com",
    },
    {
      id: "p3",
      name: "Personal Knowledge Base",
      status: "维护中",
      statusColor:
        "bg-teal-50 text-teal-600 border border-teal-200 dark:bg-teal-950/50 dark:text-teal-400 dark:border-teal-900",
      url: "https://github.com",
    },
  ];
  defaults.forEach((p, index) => {
    insertProject.run(
      p.id,
      userId,
      p.name,
      p.status,
      p.statusColor,
      p.url,
      index,
    );
  });

  db.prepare(`
    INSERT OR REPLACE INTO user_configs (user_id, logo_text, site_title)
    VALUES (?, 'Navelix', 'Navelix · Personal Digital Hub')
  `).run(userId);
}

export const SESSION_COOKIE = "navelix_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  role: string;
  avatar: string;
  created_at: number;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
  avatar: string;
}
