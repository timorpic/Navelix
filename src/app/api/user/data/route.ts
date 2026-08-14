import { NextRequest, NextResponse } from "next/server";
import { db, seedUserData } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { checkCSRF } from "@/lib/csrf";
import {
  saveUserCategories,
  saveUserLinks,
  saveUserProjects,
  saveUserTodos,
  saveUserConfigs,
} from "@/lib/user-data";
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
        link_open_target: "_blank" | "_self";
        wallpaper_mode: "none" | "bing" | "custom";
        custom_wallpaper_url: string;
        glassmorphism: number;
        sidebar_default_state: "expanded" | "collapsed";
        clock_widget_mode: "time" | "weather" | "analog";
        allow_public_access: number;
        allow_registration: number;
        custom_search_name: string;
        custom_search_url: string;
        custom_head_scripts: string;
        custom_css: string;
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
        searchEngine: (configRow.search_engine as SystemConfig["searchEngine"]) || "google",
        customSearchName: configRow.custom_search_name || "",
        customSearchUrl: configRow.custom_search_url || "",
        allowPublicAccess: configRow.allow_public_access !== 0,
        allowRegistration: configRow.allow_registration !== 0,
        customHeadScripts: configRow.custom_head_scripts || "",
        customCss: configRow.custom_css || "",
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
        linkOpenTarget: configRow.link_open_target || "_blank",
        wallpaperMode: configRow.wallpaper_mode || "none",
        customWallpaperUrl: configRow.custom_wallpaper_url || "",
        glassmorphism: configRow.glassmorphism === 1,
        sidebarDefaultState: configRow.sidebar_default_state || "expanded",
        clockWidgetMode: configRow.clock_widget_mode || "time",
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
        linkOpenTarget: "_blank",
        wallpaperMode: "none",
        customWallpaperUrl: "",
        glassmorphism: false,
        sidebarDefaultState: "expanded",
        clockWidgetMode: "time",
      };

  return NextResponse.json({
    categories: categoryRows,
    links,
    projects,
    todos,
    config,
  });
}

// POST /api/user/data - Save full categories, links, projects, todos, or config for current user
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const userId = user.id;
  // 注：middleware.ts 已对该路由统一执行 CSRF 校验，此处为纵深防御的第二道校验。
  // checkCSRF 返回对象，必须检查 .success 属性（对象本身恒为 truthy）
  const csrfResult = checkCSRF(req);
  if (!csrfResult.success) {
    return NextResponse.json(
      { error: csrfResult.error || "CSRF 验证失败" },
      { status: csrfResult.status || 403 },
    );
  }

  try {
    const body = await req.json();
    db.exec("BEGIN IMMEDIATE");

    // 安全门禁：自定义 Head 脚本 / 自定义 CSS 属于"可注入任意 HTML/JS/CSS"的高危能力，
    // 仅管理员可配置（任意登录用户若可写入，将形成存储型 XSS / 数据外泄面）。
    // 当前 CSP 放行 unsafe-inline，故必须在服务端用角色收口，而非依赖前端隐藏。
    const cfg = body.config;
    if (cfg && user.role !== "admin") {
      const hasCustomScript =
        typeof cfg.customHeadScripts === "string" &&
        cfg.customHeadScripts.trim() !== "";
      const hasCustomCss =
        typeof cfg.customCss === "string" && cfg.customCss.trim() !== "";
      if (hasCustomScript || hasCustomCss) {
        db.exec("ROLLBACK");
        return NextResponse.json(
          { error: "仅管理员可配置自定义 Head 脚本 / 自定义 CSS" },
          { status: 403 },
        );
      }
    }

    if (Array.isArray(body.categories)) {
      saveUserCategories(userId, body.categories);
    }
    if (Array.isArray(body.links)) {
      saveUserLinks(userId, body.links);
    }
    if (Array.isArray(body.projects)) {
      saveUserProjects(userId, body.projects);
    }
    if (Array.isArray(body.todos)) {
      saveUserTodos(userId, body.todos);
    }
    if (body.config) {
      saveUserConfigs(userId, body.config);
    }

    db.exec("COMMIT");
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