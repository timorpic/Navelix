import { NextRequest, NextResponse } from "next/server";
import { db, seedUserData } from "@/lib/db";
import { checkCSRF, getSessionUser } from "@/lib/auth";
import { invalidateUserData } from "@/lib/user-data";
import type { SiteLink, SystemConfig } from "@/types";
// GET /api/user/data - Fetch categories, links, and config for current logged-in user
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const userId = user.id;

  // Ensure user has starter seeded data
  seedUserData(userId);

  // Fetch categories
  const categoryRows = db
    .prepare("SELECT id, name, label, icon, color FROM user_categories WHERE user_id = ?")
    .all(userId) as Array<{
    id: string;
    name: string;
    label: string;
    icon: string;
    color: string;
  }>;

  // Fetch links
  const linkRows = db
    .prepare(
      "SELECT id, title, url, description, icon, category, is_quick_access FROM user_links WHERE user_id = ?",
    )
    .all(userId) as Array<{
    id: string;
    title: string;
    url: string;
    description: string;
    icon: string;
    category: string;
    is_quick_access: number;
  }>;

  const links: SiteLink[] = linkRows.map((l) => ({
    id: l.id,
    title: l.title,
    url: l.url,
    description: l.description,
    icon: l.icon,
    category: l.category,
    isQuickAccess: l.is_quick_access === 1,
  }));

  // Fetch projects
  const projectRows = db
    .prepare(
      `SELECT id, name, status, status_color, url
       FROM projects
       WHERE user_id = ?
       ORDER BY sort_order ASC`,
    )
    .all(userId) as Array<{
    id: string;
    name: string;
    status: string;
    status_color: string;
    url: string;
  }>;

  const projects = projectRows.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    statusColor: p.status_color,
    url: p.url,
  }));

  // Fetch todos/schedules
  const todoRows = db
    .prepare(
      `SELECT id, title, priority, done, due_date, project_id, created_at, sort_order
       FROM user_todos
       WHERE user_id = ?
       ORDER BY done ASC, sort_order ASC, created_at ASC`,
    )
    .all(userId) as Array<{
    id: string;
    title: string;
    priority: string;
    done: number;
    due_date: string;
    project_id: string;
    created_at: number;
    sort_order: number;
  }>;

  const todos = todoRows.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    done: t.done === 1,
    dueDate: t.due_date,
    projectId: t.project_id,
    createdAt: t.created_at,
    sortOrder: t.sort_order,
  }));

  // Fetch config
  const configRow = db
    .prepare("SELECT * FROM user_configs WHERE user_id = ?")
    .get(userId) as
    | {
        logo_text: string;
        logo_image: string;
        show_search_bar: number;
        max_width: "1000px" | "1200px" | "1400px" | "full";
        custom_footer: string;
        theme: "light" | "dark" | "system";
        search_engine: "google" | "baidu" | "bing" | "perplexity";
        ai_base_url: string;
        ai_api_key: string;
        ai_model: string;
        site_title: string;
        link_status_enabled: number;
        link_status_interval: number;
        social_github: string;
        social_x: string;
        social_linkedin: string;
        social_email: string;
        weather_enabled: number;
        weather_api_key: string;
        weather_location: string;
        weather_api_base_url: string;
      }
    | undefined;

  const config: SystemConfig = configRow
    ? {
        logoText: configRow.logo_text,
        logoImage: configRow.logo_image,
        showSearchBar: configRow.show_search_bar === 1 || (configRow.show_search_bar as unknown) === true || (configRow.show_search_bar as unknown) === "1",
        maxWidth: configRow.max_width,
        customFooter: configRow.custom_footer,
        theme: configRow.theme,
        searchEngine: configRow.search_engine,
        aiBaseUrl: configRow.ai_base_url,
        aiKeyConfigured: Boolean(configRow.ai_api_key),
        aiModel: configRow.ai_model,
        siteTitle: configRow.site_title,
        linkStatusEnabled: configRow.link_status_enabled === 1,
        linkStatusInterval: configRow.link_status_interval,
        socialGithub: configRow.social_github,
        socialX: configRow.social_x,
        socialLinkedin: configRow.social_linkedin,
        socialEmail: configRow.social_email,
        weatherEnabled: configRow.weather_enabled === 1,
        weatherKeyConfigured: Boolean(configRow.weather_api_key),
        weatherLocation: configRow.weather_location,
        weatherApiBaseUrl: configRow.weather_api_base_url,
      }
    : {
        logoText: "Navelix",
        logoImage: "",
        showSearchBar: true,
        maxWidth: "1200px",
        customFooter: "© 2026 Navelix. 保留所有权利。",
        theme: "system",
        searchEngine: "google",
        aiBaseUrl: "https://api.openai.com/v1",
        aiKeyConfigured: false,
        aiModel: "gpt-4o-mini",
        siteTitle: "Navelix · Personal Digital Hub",
        linkStatusEnabled: true,
        linkStatusInterval: 60,
        socialGithub: "https://github.com",
        socialX: "https://x.com",
        socialLinkedin: "https://linkedin.com",
        socialEmail: "邮箱",
        weatherEnabled: false,
        weatherKeyConfigured: false,
        weatherLocation: "",
        weatherApiBaseUrl: "https://api.seniverse.com",
      };

  return NextResponse.json({
    categories: categoryRows,
    links,
    projects,
    todos,
    config,
  });
}

// POST /api/user/data - Save full categories, links, or config for current user
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const userId = user.id;
  if (!checkCSRF(req)) {
    return NextResponse.json({ error: "CSRF 验证失败" }, { status: 403 });
  }

  try {
    const body = await req.json();
    db.exec("BEGIN IMMEDIATE");

    if (Array.isArray(body.categories)) {
      const incomingIds: string[] = [];
      const upsertCat = db.prepare(`
        INSERT INTO user_categories (id, user_id, name, label, icon, color)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id, user_id) DO UPDATE SET
          name = excluded.name,
          label = excluded.label,
          icon = excluded.icon,
          color = excluded.color
      `);
      for (const c of body.categories) {
        if (!c || typeof c !== "object") continue;
        const catId = String(c.id || crypto.randomUUID());
        incomingIds.push(catId);
        upsertCat.run(catId, userId, String(c.name || ""), String(c.label || c.name || ""), String(c.icon || "📂"), String(c.color || "#00C776"));
      }
      if (incomingIds.length > 0) {
        const placeholders = incomingIds.map(() => "?").join(",");
        db.prepare(`DELETE FROM user_categories WHERE user_id = ? AND id NOT IN (${placeholders})`).run(userId, ...incomingIds);
      } else {
        db.prepare("DELETE FROM user_categories WHERE user_id = ?").run(userId);
      }
    }

    if (Array.isArray(body.links)) {
      const incomingIds: string[] = [];
      const upsertLink = db.prepare(`
        INSERT INTO user_links (id, user_id, title, url, description, icon, category, is_quick_access)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id, user_id) DO UPDATE SET
          title = excluded.title,
          url = excluded.url,
          description = excluded.description,
          icon = excluded.icon,
          category = excluded.category,
          is_quick_access = excluded.is_quick_access
      `);
      for (const l of body.links) {
        if (!l || typeof l !== "object") continue;
        const linkId = String(l.id || crypto.randomUUID());
        incomingIds.push(linkId);
        upsertLink.run(
          linkId,
          userId,
          String(l.title || "未命名链接"),
          String(l.url || "https://example.com"),
          String(l.description || ""),
          String(l.icon || ""),
          String(l.category || "uncategorized"),
          l.isQuickAccess ? 1 : 0,
        );
      }
      if (incomingIds.length > 0) {
        const placeholders = incomingIds.map(() => "?").join(",");
        db.prepare(`DELETE FROM user_links WHERE user_id = ? AND id NOT IN (${placeholders})`).run(userId, ...incomingIds);
      } else {
        db.prepare("DELETE FROM user_links WHERE user_id = ?").run(userId);
      }
    }

    if (Array.isArray(body.projects)) {
      const incomingIds: string[] = [];
      const upsertProject = db.prepare(`
        INSERT INTO projects (id, user_id, name, status, status_color, url, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id, user_id) DO UPDATE SET
          name = excluded.name,
          status = excluded.status,
          status_color = excluded.status_color,
          url = excluded.url,
          sort_order = excluded.sort_order
      `);
      body.projects.forEach(
        (p: { id?: string; name?: string; status?: string; statusColor?: string; url?: string }, index: number) => {
          if (!p || typeof p !== "object") return;
          const projId = String(p.id || `proj-${Date.now()}-${index}`);
          incomingIds.push(projId);
          upsertProject.run(
            projId,
            userId,
            String(p.name || "未命名项目"),
            String(p.status || "进行中"),
            String(p.statusColor || ""),
            String(p.url || ""),
            index,
          );
        },
      );
      if (incomingIds.length > 0) {
        const placeholders = incomingIds.map(() => "?").join(",");
        db.prepare(`DELETE FROM projects WHERE user_id = ? AND id NOT IN (${placeholders})`).run(userId, ...incomingIds);
      } else {
        db.prepare("DELETE FROM projects WHERE user_id = ?").run(userId);
      }
    }

    if (Array.isArray(body.todos)) {
      const incomingIds: string[] = [];
      const upsertTodo = db.prepare(`
        INSERT INTO user_todos (id, user_id, title, priority, done, due_date, project_id, created_at, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id, user_id) DO UPDATE SET
          title = excluded.title,
          priority = excluded.priority,
          done = excluded.done,
          due_date = excluded.due_date,
          project_id = excluded.project_id,
          sort_order = excluded.sort_order
      `);
      body.todos.forEach(
        (
          t: {
            id?: string;
            title?: string;
            priority?: string;
            done?: boolean;
            dueDate?: string;
            projectId?: string;
            createdAt?: number;
            sortOrder?: number;
          },
          index: number,
        ) => {
          if (!t || typeof t !== "object") return;
          const todoId = String(t.id || `todo-${Date.now()}-${index}`);
          incomingIds.push(todoId);
          upsertTodo.run(
            todoId,
            userId,
            String(t.title || "未命名日程"),
            String(t.priority || "medium"),
            t.done ? 1 : 0,
            String(t.dueDate || ""),
            String(t.projectId || ""),
            t.createdAt || Date.now(),
            t.sortOrder ?? index,
          );
        },
      );
      if (incomingIds.length > 0) {
        const placeholders = incomingIds.map(() => "?").join(",");
        db.prepare(`DELETE FROM user_todos WHERE user_id = ? AND id NOT IN (${placeholders})`).run(userId, ...incomingIds);
      } else {
        db.prepare("DELETE FROM user_todos WHERE user_id = ?").run(userId);
      }
    }

    if (body.config) {
      const cfg = body.config;
      const currentRow = db
        .prepare("SELECT * FROM user_configs WHERE user_id = ?")
        .get(userId) as Record<string, unknown> | undefined;

      const logoText = typeof cfg.logoText === "string" ? cfg.logoText : String(currentRow?.logo_text || "Navelix");
      const logoImage = typeof cfg.logoImage === "string" ? cfg.logoImage : String(currentRow?.logo_image || "");
      const showSearchBar =
        typeof cfg.showSearchBar === "boolean"
          ? cfg.showSearchBar
            ? 1
            : 0
          : Number(currentRow?.show_search_bar ?? 1);
      const maxWidth = typeof cfg.maxWidth === "string" ? cfg.maxWidth : String(currentRow?.max_width || "1200px");
      const customFooter = typeof cfg.customFooter === "string" ? cfg.customFooter : String(currentRow?.custom_footer || "© 2026 Navelix. 保留所有权利。");
      const theme = typeof cfg.theme === "string" ? cfg.theme : String(currentRow?.theme || "system");
      const searchEngine = typeof cfg.searchEngine === "string" ? cfg.searchEngine : String(currentRow?.search_engine || "google");
      const aiBaseUrl = typeof cfg.aiBaseUrl === "string" ? cfg.aiBaseUrl : String(currentRow?.ai_base_url || "https://api.openai.com/v1");
      const aiApiKey =
        typeof cfg.aiApiKey === "string" && cfg.aiApiKey.trim() !== ""
          ? cfg.aiApiKey.trim()
          : String(currentRow?.ai_api_key || "");
      const aiModel = typeof cfg.aiModel === "string" ? cfg.aiModel : String(currentRow?.ai_model || "gpt-4o-mini");
      const siteTitle = typeof cfg.siteTitle === "string" ? cfg.siteTitle : String(currentRow?.site_title || "Navelix · Personal Digital Hub");
      const linkStatusEnabled =
        typeof cfg.linkStatusEnabled === "boolean"
          ? cfg.linkStatusEnabled
            ? 1
            : 0
          : Number(currentRow?.link_status_enabled ?? 1);
      const linkStatusInterval = typeof cfg.linkStatusInterval === "number" ? cfg.linkStatusInterval : Number(currentRow?.link_status_interval ?? 60);
      const socialGithub = typeof cfg.socialGithub === "string" ? cfg.socialGithub : String(currentRow?.social_github || "");
      const socialX = typeof cfg.socialX === "string" ? cfg.socialX : String(currentRow?.social_x || "");
      const socialLinkedin = typeof cfg.socialLinkedin === "string" ? cfg.socialLinkedin : String(currentRow?.social_linkedin || "");
      const socialEmail = typeof cfg.socialEmail === "string" ? cfg.socialEmail : String(currentRow?.social_email || "");

      const weatherEnabled =
        typeof cfg.weatherEnabled === "boolean"
          ? cfg.weatherEnabled
            ? 1
            : 0
          : Number(currentRow?.weather_enabled ?? 0);
      const weatherApiKey =
        typeof cfg.weatherApiKey === "string" && cfg.weatherApiKey.trim() !== ""
          ? cfg.weatherApiKey.trim()
          : String(currentRow?.weather_api_key || "");
      const weatherLocation = typeof cfg.weatherLocation === "string" ? cfg.weatherLocation : String(currentRow?.weather_location || "");
      const weatherApiBaseUrl = typeof cfg.weatherApiBaseUrl === "string" ? cfg.weatherApiBaseUrl : String(currentRow?.weather_api_base_url || "https://api.seniverse.com");

      db.prepare(`
        INSERT OR REPLACE INTO user_configs (user_id, logo_text, logo_image, show_search_bar, max_width, custom_footer, theme, search_engine, ai_base_url, ai_api_key, ai_model, site_title, link_status_enabled, link_status_interval, social_github, social_x, social_linkedin, social_email, weather_enabled, weather_api_key, weather_location, weather_api_base_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        logoText,
        logoImage,
        showSearchBar,
        maxWidth,
        customFooter,
        theme,
        searchEngine,
        aiBaseUrl,
        aiApiKey,
        aiModel,
        siteTitle,
        linkStatusEnabled,
        linkStatusInterval,
        socialGithub,
        socialX,
        socialLinkedin,
        socialEmail,
        weatherEnabled,
        weatherApiKey,
        weatherLocation,
        weatherApiBaseUrl,
      );
    }

    db.exec("COMMIT");
    invalidateUserData();
    return NextResponse.json({ success: true });
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // rollback error ignore
    }
    const message = err instanceof Error ? err.message : "保存配置失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}