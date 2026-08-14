import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import {
  categories as seedCategories,
  seedQuickAccess,
  siteLinks as seedLinks,
} from "../data/links.ts";
import { runMigrations } from "./migrations/index.ts";

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
db.exec("PRAGMA foreign_keys = ON;");
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
    email TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'user',
    avatar TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_agent TEXT NOT NULL DEFAULT '',
    ip_address TEXT NOT NULL DEFAULT '',
    last_active_at INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS api_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    token_prefix TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS user_categories (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    label TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    PRIMARY KEY (id, user_id)
  );

  CREATE TABLE IF NOT EXISTS user_links (
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

  CREATE TABLE IF NOT EXISTS user_configs (
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
    social_email TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    read INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    status_color TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, user_id)
  );

  CREATE TABLE IF NOT EXISTS user_todos (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    done INTEGER NOT NULL DEFAULT 0,
    due_date TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, user_id)
  );
`);

// 迁移逻辑已抽离至 src/lib/migrations/index.ts（Schema 版本 v1~v6 + 数据修复）
runMigrations(db);

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
  email?: string;
  bio?: string;
  role: string;
  avatar: string;
  created_at: number;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  bio: string;
  role: "admin" | "user";
  avatar: string;
}
