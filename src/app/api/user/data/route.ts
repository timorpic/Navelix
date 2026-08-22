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
import { emitUserEvent } from "@/lib/events";
import { isEEAvailable } from "@/lib/ee-bridge";
import { canAccessFeature } from "@/lib/license";
import type { SiteLink, SystemConfig } from "@/types";
import { DEFAULT_SITE_TITLE } from "@/lib/constants";

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
      "SELECT id, title, url, description, icon, category, notes, is_quick_access FROM user_links WHERE user_id = ?",
    )
    .all(userId) as Array<{
    id: string;
    title: string;
    url: string;
    description: string;
    icon: string;
    category: string;
    notes: string;
    is_quick_access: number;
  }>;

  const links: SiteLink[] = linkRows.map((l) => ({
    id: l.id,
    title: l.title,
    url: l.url,
    description: l.description,
    icon: l.icon,
    category: l.category,
    notes: l.notes || undefined,
    isQuickAccess: l.is_quick_access === 1,
  }));

  // Fetch projects
  const projectRows = db
    .prepare(
      `SELECT id, name, status, status_color, url, description, sort_order, created_at, updated_at
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
    description: string;
    sort_order: number;
    created_at: number;
    updated_at: number;
  }>;

  const projects = projectRows.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    statusColor: p.status_color,
    url: p.url,
    description: p.description,
    sortOrder: p.sort_order,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
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
        security_setup_done: number;
        model_monitor_enabled: number;
        ai_copilot_enabled: number;
        today_activity_enabled: number;
        recent_visits_enabled: number;
        pending_reminders_enabled: number;
        today_summary_enabled: number;
        social_links_enabled: number;
        custom_head_scripts: string;
        custom_css: string;
      }
    | undefined;

  let effectiveAllowPublicAccess = configRow
    ? (configRow.allow_public_access === 1 || (configRow.allow_public_access as unknown) === true || (configRow.allow_public_access as unknown) === "1")
    : false;
  let effectiveAllowRegistration = configRow
    ? (configRow.allow_registration === 1 || (configRow.allow_registration as unknown) === true || (configRow.allow_registration as unknown) === "1")
    : false;

  if (user.role !== "admin") {
    const adminConfigRow = db
      .prepare(
        `SELECT allow_public_access, allow_registration 
         FROM user_configs 
         JOIN users ON users.id = user_configs.user_id 
         WHERE users.role = 'admin' 
         ORDER BY users.created_at ASC LIMIT 1`
      )
      .get() as { allow_public_access?: number; allow_registration?: number } | undefined;

    if (adminConfigRow) {
      effectiveAllowPublicAccess = adminConfigRow.allow_public_access === 1;
      effectiveAllowRegistration = adminConfigRow.allow_registration === 1;
    }
  }

  const hasCodeInject = isEEAvailable() && canAccessFeature("custom_code_injection");
  const hasBrandCustom = isEEAvailable() && canAccessFeature("brand_customization");
  const hasProbes = isEEAvailable() && canAccessFeature("link_status_monitor");

  const config: SystemConfig = configRow
    ? {
        logoText: hasBrandCustom ? configRow.logo_text || "Navelix" : "Navelix",
        logoImage: hasBrandCustom ? configRow.logo_image || "" : "",
        siteTitle: hasBrandCustom ? configRow.site_title || DEFAULT_SITE_TITLE : DEFAULT_SITE_TITLE,
        showSearchBar: configRow.show_search_bar === 1 || (configRow.show_search_bar as unknown) === true || (configRow.show_search_bar as unknown) === "1",
        maxWidth: configRow.max_width,
        customFooter: configRow.custom_footer,
        theme: configRow.theme,
        allowPublicAccess: effectiveAllowPublicAccess,
        allowRegistration: effectiveAllowRegistration,
        securitySetupDone: configRow.security_setup_done === 1 || (configRow.security_setup_done as unknown) === true || (configRow.security_setup_done as unknown) === "1",
        modelMonitorEnabled: configRow.model_monitor_enabled === 1 || (configRow.model_monitor_enabled as unknown) === true || (configRow.model_monitor_enabled as unknown) === "1",
        aiCopilotEnabled: configRow.ai_copilot_enabled === 1 || (configRow.ai_copilot_enabled as unknown) === true || (configRow.ai_copilot_enabled as unknown) === "1",
        todayActivityEnabled: configRow.today_activity_enabled === 1 || (configRow.today_activity_enabled as unknown) === true || (configRow.today_activity_enabled as unknown) === "1",
        recentVisitsEnabled: configRow.recent_visits_enabled === 1 || (configRow.recent_visits_enabled as unknown) === true || (configRow.recent_visits_enabled as unknown) === "1",
        pendingRemindersEnabled: configRow.pending_reminders_enabled === 1 || (configRow.pending_reminders_enabled as unknown) === true || (configRow.pending_reminders_enabled as unknown) === "1",
        todaySummaryEnabled: configRow.today_summary_enabled === 1 || (configRow.today_summary_enabled as unknown) === true || (configRow.today_summary_enabled as unknown) === "1",
        socialLinksEnabled: configRow.social_links_enabled === 1 || (configRow.social_links_enabled as unknown) === true || (configRow.social_links_enabled as unknown) === "1",
        customHeadScripts: hasCodeInject ? configRow.custom_head_scripts || "" : "",
        customCss: hasCodeInject ? configRow.custom_css || "" : "",
        aiBaseUrl: configRow.ai_base_url,
        aiKeyConfigured: Boolean(configRow.ai_api_key),
        aiModel: configRow.ai_model,
        linkStatusEnabled: hasProbes ? configRow.link_status_enabled === 1 : false,
        linkStatusInterval: hasProbes ? configRow.link_status_interval || 60 : 60,
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
        aiBaseUrl: "https://api.openai.com/v1",
        aiKeyConfigured: false,
        aiModel: "gpt-4o-mini",
        siteTitle: DEFAULT_SITE_TITLE,
        allowPublicAccess: false,
        allowRegistration: false,
        securitySetupDone: false,
        modelMonitorEnabled: true,
        aiCopilotEnabled: true,
        todayActivityEnabled: true,
        recentVisitsEnabled: true,
        pendingRemindersEnabled: false,
        todaySummaryEnabled: false,
        socialLinksEnabled: true,
        linkStatusEnabled: false,
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

    // 安全门禁与 Pro 商业权限管控：
    // 1. 普通用户禁止修改全局安全策略与 Pro 特权字段
    // 2. 未激活 Pro / 开源社区版（CE）环境下，服务端自动剥离 Pro 专享字段（Logo自定义、品牌定制、代码注入、网络探针），杜绝接口级篡改
    const cfg = body.config;
    if (cfg) {
      if (user.role !== "admin") {
        delete cfg.allowPublicAccess;
        delete cfg.allowRegistration;
        delete cfg.customHeadScripts;
        delete cfg.customCss;
        delete cfg.logoImage;
        delete cfg.siteTitle;
        delete cfg.logoText;
        delete cfg.linkStatusEnabled;
        delete cfg.linkStatusInterval;
      } else {
        const hasCodeInject = isEEAvailable() && canAccessFeature("custom_code_injection");
        if (!hasCodeInject) {
          delete cfg.customHeadScripts;
          delete cfg.customCss;
        }
        const hasBrandCustom = isEEAvailable() && canAccessFeature("brand_customization");
        if (!hasBrandCustom) {
          delete cfg.logoImage;
          delete cfg.siteTitle;
          delete cfg.logoText;
        }
        const hasProbes = isEEAvailable() && canAccessFeature("link_status_monitor");
        if (!hasProbes) {
          delete cfg.linkStatusEnabled;
          delete cfg.linkStatusInterval;
        }
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

    // 广播实时变更通知
    if (Array.isArray(body.links)) emitUserEvent(userId, "links:change");
    if (Array.isArray(body.categories)) emitUserEvent(userId, "categories:change");
    if (Array.isArray(body.projects)) emitUserEvent(userId, "projects:change");
    if (Array.isArray(body.todos)) emitUserEvent(userId, "todos:change");

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