import type { DatabaseSync } from "node:sqlite";
import {
  categories as seedCategories,
  seedQuickAccess,
  siteLinks as seedLinks,
} from "../../data/links.ts";

// Seed user starter categories and links ONLY ONCE on initial user creation
export function seedInitialUserData(db: DatabaseSync, userId: string) {
  // 配置可独立于内容创建，因此用分类是否存在判断内容是否已播种。
  const seeded = db
    .prepare("SELECT 1 FROM user_categories WHERE user_id = ? LIMIT 1")
    .get(userId);

  // 如果用户已经进行过初始化（已存在分类记录），绝对不要重复 re-seed 覆盖用户数据
  if (seeded) {
    return;
  }

  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO user_categories (id, user_id, name, label, icon, color)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const c of seedCategories) {
    insertCat.run(c.id, userId, c.name, c.label, c.icon, c.color);
  }

  const insertLink = db.prepare(`
    INSERT OR IGNORE INTO user_links (id, user_id, title, url, description, icon, category, is_quick_access)
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
    INSERT OR IGNORE INTO projects (id, user_id, name, status, status_color, url, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const defaults = [
    {
      id: "p1",
      name: "IT 运维管家官网",
      status: "in-progress",
      statusColor:
        "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900",
      url: "",
    },
    {
      id: "p2",
      name: "AI Memory Architecture",
      status: "research",
      statusColor:
        "bg-sky-50 text-sky-600 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-400 dark:border-sky-900",
      url: "",
    },
    {
      id: "p3",
      name: "Personal Knowledge Base",
      status: "maintenance",
      statusColor:
        "bg-teal-50 text-teal-600 border border-teal-200 dark:bg-teal-950/50 dark:text-teal-400 dark:border-teal-900",
      url: "",
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

  // 全站配置为单例行（见 lib/global-config.ts）：不再按用户各建一行，
  // 单例行由 resolveGlobalConfigOwnerId → ensureConfigRowAt 惰性创建（含列默认值）。
}
