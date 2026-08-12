import { NextRequest, NextResponse } from "next/server";
import { db, seedUserData } from "@/lib/db";
import { checkCSRF, getSessionUser } from "@/lib/auth";
import { invalidateUserData } from "@/lib/user-data";
import type { SiteLink, SystemConfig } from "@/types";
// GET /api/user/data - Fetch categories, links, and config for current logged-in user
export async function GET(req: NextRequest) {
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
        showSearchBar: configRow.show_search_bar === 1,
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
    try { db.exec("BEGIN"); } catch { /* no-op */ }

    if (Array.isArray(body.categories)) {
      db.prepare("DELETE FROM user_categories WHERE user_id = ?").run(userId);
      const insertCat = db.prepare(`
        INSERT INTO user_categories (id, user_id, name, label, icon, color)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const c of body.categories) {
        insertCat.run(c.id, userId, c.name, c.label || c.name, c.icon || "📂", c.color || "#00C776");
      }
    }

    if (Array.isArray(body.links)) {
      db.prepare("DELETE FROM user_links WHERE user_id = ?").run(userId);
      const insertLink = db.prepare(`
        INSERT OR REPLACE INTO user_links (id, user_id, title, url, description, icon, category, is_quick_access)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const l of body.links) {
        if (!l || typeof l !== "object") continue;
        insertLink.run(
          String(l.id || crypto.randomUUID()),
          userId,
          String(l.title || "未命名链接"),
          String(l.url || "https://example.com"),
          String(l.description || ""),
          String(l.icon || ""),
          String(l.category || "uncategorized"),
          l.isQuickAccess ? 1 : 0,
        );
      }
    }

    if (Array.isArray(body.projects)) {
      db.prepare("DELETE FROM projects WHERE user_id = ?").run(userId);
      const insertProject = db.prepare(`
        INSERT INTO projects (id, user_id, name, status, status_color, url, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      body.projects.forEach(
        (p: { id?: string; name?: string; status?: string; statusColor?: string; url?: string }, index: number) => {
          insertProject.run(
            String(p.id || `proj-${Date.now()}-${index}`),
            userId,
            String(p.name || "未命名项目"),
            String(p.status || "进行中"),
            String(p.statusColor || ""),
            String(p.url || ""),
            index,
          );
        },
      );
    }

    if (body.config) {
      const cfg = body.config;
      // 安全：密钥字段为空时保留数据库现有值（不下发明文，不覆盖）
      const currentRow = db
        .prepare(
          "SELECT ai_api_key, weather_api_key FROM user_configs WHERE user_id = ?",
        )
        .get(userId) as
        | { ai_api_key: string; weather_api_key: string }
        | undefined;
      const aiApiKey =
        typeof cfg.aiApiKey === "string" && cfg.aiApiKey.trim() !== ""
          ? cfg.aiApiKey.trim()
          : (currentRow?.ai_api_key || "");
      const weatherApiKey =
        typeof cfg.weatherApiKey === "string" && cfg.weatherApiKey.trim() !== ""
          ? cfg.weatherApiKey.trim()
          : (currentRow?.weather_api_key || "");

      db.prepare(`
        INSERT OR REPLACE INTO user_configs (user_id, logo_text, logo_image, show_search_bar, max_width, custom_footer, theme, search_engine, ai_base_url, ai_api_key, ai_model, site_title, link_status_enabled, link_status_interval, social_github, social_x, social_linkedin, social_email, weather_enabled, weather_api_key, weather_location, weather_api_base_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        cfg.logoText || "Navelix",
        cfg.logoImage || "",
        cfg.showSearchBar ? 1 : 0,
        cfg.maxWidth || "1200px",
        cfg.customFooter || "© 2026 Navelix. 保留所有权利。",
        cfg.theme || "system",
        cfg.searchEngine || "google",
        cfg.aiBaseUrl || "https://api.openai.com/v1",
        aiApiKey,
        cfg.aiModel || "gpt-4o-mini",
        cfg.siteTitle || "Navelix · Personal Digital Hub",
        cfg.linkStatusEnabled === false ? 0 : 1,
        cfg.linkStatusInterval || 60,
        cfg.socialGithub || "",
        cfg.socialX || "",
        cfg.socialLinkedin || "",
        cfg.socialEmail || "",
        cfg.weatherEnabled ? 1 : 0,
        weatherApiKey,
        cfg.weatherLocation || "",
        cfg.weatherApiBaseUrl || "https://api.seniverse.com",
      );
    }

    try { db.exec("COMMIT"); } catch { /* no-op */ }
    invalidateUserData(userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    try { db.exec("ROLLBACK"); } catch { /* no-op */ }
    const message = err instanceof Error ? err.message : "保存配置失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}