import { db, seedUserData, type PublicUser } from "./db.ts";
import type { Category, Project, SiteLink, SystemConfig } from "@/types";
import { encryptSecret } from "./secret.ts";
import { recordAuditLog } from "./audit.ts";

export interface UserDataResult {
  user?: PublicUser | null;
  categories: Category[];
  links: SiteLink[];
  projects: Project[];
  config: SystemConfig;
}

/**
 * 服务端获取用户的完整数据（分类、链接、项目、配置、用户信息）。
 * 用于 SSR 预取：在 Layout 中调用，数据通过 props 传给客户端 Provider。
 * 直接实时查询 SQLite（<0.2ms），确保新增、编辑、删除链接后刷新页面 100% 实时生效。
 * 注：SQLite WAL 模式实时读写，commit 后即可读到，无需主动缓存失效。
 */
export function getUserData(userId: string): UserDataResult {
  // Ensure user has starter seeded data
  seedUserData(userId);

  // Fetch current user details
  const userRow = db
    .prepare("SELECT id, username, display_name, email, bio, role, avatar FROM users WHERE id = ?")
    .get(userId) as Record<string, unknown> | undefined;

  const user: PublicUser | null = userRow
    ? {
        id: String(userRow.id),
        username: String(userRow.username),
        displayName: String(userRow.display_name || userRow.username),
        email: String(userRow.email || ""),
        bio: String(userRow.bio || ""),
        role: userRow.role === "admin" ? "admin" : "user",
        avatar: String(userRow.avatar || ""),
      }
    : null;

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
      `SELECT id, name, description, status, status_color, url, sort_order, created_at, updated_at
       FROM projects
       WHERE user_id = ?
       ORDER BY sort_order ASC, created_at ASC`,
    )
    .all(userId) as Array<{
    id: string;
    name: string;
    description: string | null;
    status: string | null;
    status_color: string | null;
    url: string | null;
    sort_order: number;
    created_at: number | null;
    updated_at: number | null;
  }>;

  const projects: Project[] = projectRows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description || "",
    status: (p.status as Project["status"]) || "in-progress",
    color: p.status_color || "#00C776",
    statusColor: p.status_color || "#00C776",
    url: p.url || "",
    sortOrder: p.sort_order,
    createdAt: p.created_at ?? undefined,
    updatedAt: p.updated_at ?? undefined,
  }));

  // Fetch config
  const configRow = db
    .prepare("SELECT * FROM user_configs WHERE user_id = ?")
    .get(userId) as Record<string, unknown> | undefined;

  const config: SystemConfig = configRow
    ? {
        logoText: String(configRow.logo_text || "Navelix"),
        logoImage: String(configRow.logo_image || ""),
        showSearchBar: configRow.show_search_bar === 1 || configRow.show_search_bar === true || configRow.show_search_bar === "1",
        maxWidth: (configRow.max_width as SystemConfig["maxWidth"]) || "1200px",
        customFooter: String(configRow.custom_footer || "© 2026 Navelix. 保留所有权利。"),
        theme: (configRow.theme as SystemConfig["theme"]) || "system",
        searchEngine: (configRow.search_engine as SystemConfig["searchEngine"]) || "google",
        customSearchName: String(configRow.custom_search_name || ""),
        customSearchUrl: String(configRow.custom_search_url || ""),
        allowPublicAccess: configRow.allow_public_access !== 0 && configRow.allow_public_access !== false && configRow.allow_public_access !== "0",
        allowRegistration: configRow.allow_registration !== 0 && configRow.allow_registration !== false && configRow.allow_registration !== "0",
        customHeadScripts: String(configRow.custom_head_scripts || ""),
        customCss: String(configRow.custom_css || ""),
        aiBaseUrl: String(configRow.ai_base_url || "https://api.openai.com/v1"),
        // 安全：不下发明文密钥，仅返回是否已配置标记
        aiKeyConfigured: Boolean(configRow.ai_api_key),
        aiModel: String(configRow.ai_model || "gpt-4o-mini"),
        siteTitle: String(configRow.site_title || "Navelix · Personal Digital Hub"),
        linkStatusEnabled: configRow.link_status_enabled === 1 || configRow.link_status_enabled === true || configRow.link_status_enabled === "1",
        linkStatusInterval: Number(configRow.link_status_interval) || 60,
        socialGithub: String(configRow.social_github || ""),
        socialX: String(configRow.social_x || ""),
        socialLinkedin: String(configRow.social_linkedin || ""),
        socialEmail: String(configRow.social_email || ""),
        weatherEnabled: configRow.weather_enabled === 1,
        weatherKeyConfigured: Boolean(configRow.weather_api_key),
        weatherLocation: String(configRow.weather_location || ""),
        weatherApiBaseUrl: String(configRow.weather_api_base_url || "https://api.seniverse.com"),
        sensenovaEnabled: configRow.sensenova_enabled === 1,
        sensenovaConfigured: Boolean(configRow.sensenova_username && configRow.sensenova_password),
        sensenovaUsername: String(configRow.sensenova_username || ""),
        sensenovaAccountId: String(configRow.sensenova_account_id || ""),
        isPro: configRow.is_pro === 1 || configRow.is_pro === true || configRow.is_pro === "1",
        linkOpenTarget: (configRow.link_open_target as SystemConfig["linkOpenTarget"]) || "_blank",
        wallpaperMode: (configRow.wallpaper_mode as SystemConfig["wallpaperMode"]) || "none",
        customWallpaperUrl: String(configRow.custom_wallpaper_url || ""),
        glassmorphism: configRow.glassmorphism === 1 || configRow.glassmorphism === true || configRow.glassmorphism === "1",
        sidebarDefaultState: (configRow.sidebar_default_state as SystemConfig["sidebarDefaultState"]) || "expanded",
        clockWidgetMode: (configRow.clock_widget_mode as SystemConfig["clockWidgetMode"]) || "time",
      }
    : {
        logoText: "Navelix",
        logoImage: "",
        isPro: false,
        showSearchBar: true,
        maxWidth: "1200px",
        customFooter: "© 2026 Navelix. 保留所有权利。",
        theme: "system",
        searchEngine: "google",
        customSearchName: "",
        customSearchUrl: "",
        allowPublicAccess: true,
        allowRegistration: true,
        customHeadScripts: "",
        customCss: "",
        aiBaseUrl: "https://api.openai.com/v1",
        aiKeyConfigured: false,
        aiModel: "gpt-4o-mini",
        siteTitle: "Navelix · Personal Digital Hub",
        linkStatusEnabled: true,
        linkStatusInterval: 60,
        socialGithub: "",
        socialX: "",
        socialLinkedin: "",
        socialEmail: "",
        weatherEnabled: false,
        weatherKeyConfigured: false,
        weatherLocation: "",
        weatherApiBaseUrl: "https://api.seniverse.com",
        sensenovaEnabled: false,
        sensenovaConfigured: false,
        sensenovaUsername: "",
        sensenovaAccountId: "",
        linkOpenTarget: "_blank",
        wallpaperMode: "none",
        customWallpaperUrl: "",
        glassmorphism: false,
        sidebarDefaultState: "expanded",
        clockWidgetMode: "time",
      };

  const result: UserDataResult = { user, categories: categoryRows as Category[], links, projects, config };
  // SQLite 返回的行对象原型非标准（null 原型），
  // Next.js 要求传给客户端组件的数据必须是纯对象，深拷贝处理。
  return JSON.parse(JSON.stringify(result)) as UserDataResult;
}

// ── 实体保存（服务端 POST /api/user/data 调用，含 upsert 与 diff 删除语义）──

/** 分类输入（宽松类型，运行期校验并安全转换） */
interface CategoryInput {
  id?: unknown;
  name?: unknown;
  label?: unknown;
  icon?: unknown;
  color?: unknown;
}

/** 链接输入 */
interface LinkInput {
  id?: unknown;
  title?: unknown;
  url?: unknown;
  description?: unknown;
  icon?: unknown;
  category?: unknown;
  isQuickAccess?: unknown;
}

/** 项目输入 */
interface ProjectInput {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  status?: unknown;
  statusColor?: unknown;
  color?: unknown;
  url?: unknown;
  sortOrder?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** 待办输入 */
interface TodoInput {
  id?: unknown;
  title?: unknown;
  priority?: unknown;
  done?: unknown;
  dueDate?: unknown;
  projectId?: unknown;
  assigneeId?: unknown;
  assigneeName?: unknown;
  createdAt?: unknown;
  sortOrder?: unknown;
}

/** 保存分类：upsert 传入项，删除不在列表中的旧分类 */
export function saveUserCategories(userId: string, items: CategoryInput[]): void {
  const incomingIds: string[] = [];
  const upsert = db.prepare(`
    INSERT INTO user_categories (id, user_id, name, label, icon, color)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id, user_id) DO UPDATE SET
      name = excluded.name,
      label = excluded.label,
      icon = excluded.icon,
      color = excluded.color
  `);
  for (const c of items) {
    if (!c || typeof c !== "object") continue;
    const catId = String(c.id || crypto.randomUUID());
    incomingIds.push(catId);
    upsert.run(
      catId,
      userId,
      String(c.name || ""),
      String(c.label || c.name || ""),
      String(c.icon || "📂"),
      String(c.color || "#00C776"),
    );
  }
  if (incomingIds.length > 0) {
    const placeholders = incomingIds.map(() => "?").join(",");
    db.prepare(
      `DELETE FROM user_categories WHERE user_id = ? AND id NOT IN (${placeholders})`,
    ).run(userId, ...incomingIds);
  } else {
    db.prepare("DELETE FROM user_categories WHERE user_id = ?").run(userId);
  }
}

/** 保存链接：upsert 传入项，删除不在列表中的旧链接 */
export function saveUserLinks(userId: string, items: LinkInput[]): void {
  const incomingIds: string[] = [];
  const upsert = db.prepare(`
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
  for (const l of items) {
    if (!l || typeof l !== "object") continue;
    const linkId = String(l.id || crypto.randomUUID());
    incomingIds.push(linkId);
    upsert.run(
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
    db.prepare(
      `DELETE FROM user_links WHERE user_id = ? AND id NOT IN (${placeholders})`,
    ).run(userId, ...incomingIds);
  } else {
    db.prepare("DELETE FROM user_links WHERE user_id = ?").run(userId);
  }
}

/** 保存项目：upsert 传入项，删除不在列表中的旧项目 */
export function saveUserProjects(userId: string, items: ProjectInput[]): void {
  const incomingIds: string[] = [];
  const now = Date.now();
  const upsert = db.prepare(`
    INSERT INTO projects (id, user_id, name, description, status, status_color, url, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id, user_id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      status = excluded.status,
      status_color = excluded.status_color,
      url = excluded.url,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `);
  items.forEach((p, index) => {
    if (!p || typeof p !== "object") return;
    const projId = String(p.id || `proj-${Date.now()}-${index}`);
    incomingIds.push(projId);
    upsert.run(
      projId,
      userId,
      String(p.name || "未命名项目"),
      String(p.description || ""),
      String(p.status || "in-progress"),
      String(p.statusColor || p.color || "#00C776"),
      String(p.url || ""),
      typeof p.sortOrder === "number" ? p.sortOrder : index,
      typeof p.createdAt === "number" ? p.createdAt : now,
      typeof p.updatedAt === "number" ? p.updatedAt : now,
    );
  });
  if (incomingIds.length > 0) {
    const placeholders = incomingIds.map(() => "?").join(",");
    db.prepare(
      `DELETE FROM projects WHERE user_id = ? AND id NOT IN (${placeholders})`,
    ).run(userId, ...incomingIds);
  } else {
    db.prepare("DELETE FROM projects WHERE user_id = ?").run(userId);
  }
}

/** 保存待办：upsert 传入项，删除不在列表中的旧待办 */
export function saveUserTodos(userId: string, items: TodoInput[]): void {
  const incomingIds: string[] = [];
  const now = Date.now();
  const upsert = db.prepare(`
    INSERT INTO user_todos (id, user_id, title, priority, done, due_date, project_id, assignee_id, assignee_name, created_at, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id, user_id) DO UPDATE SET
      title = excluded.title,
      priority = excluded.priority,
      done = excluded.done,
      due_date = excluded.due_date,
      project_id = excluded.project_id,
      assignee_id = excluded.assignee_id,
      assignee_name = excluded.assignee_name,
      sort_order = excluded.sort_order
  `);
  items.forEach((t, index) => {
    if (!t || typeof t !== "object") return;
    const todoId = String(t.id || `todo-${Date.now()}-${index}`);
    incomingIds.push(todoId);
    upsert.run(
      todoId,
      userId,
      String(t.title || "未命名日程"),
      String(t.priority || "medium"),
      t.done ? 1 : 0,
      String(t.dueDate || ""),
      String(t.projectId || ""),
      String(t.assigneeId || ""),
      String(t.assigneeName || ""),
      typeof t.createdAt === "number" ? t.createdAt : now,
      typeof t.sortOrder === "number" ? t.sortOrder : index,
    );
  });
  if (incomingIds.length > 0) {
    const placeholders = incomingIds.map(() => "?").join(",");
    db.prepare(
      `DELETE FROM user_todos WHERE user_id = ? AND id NOT IN (${placeholders})`,
    ).run(userId, ...incomingIds);
  } else {
    db.prepare("DELETE FROM user_todos WHERE user_id = ?").run(userId);
  }
}

/** 配置输入（宽松对象，运行期逐字段校验；密钥字段留空 = 保持不变） */
export type ConfigInput = Record<string, unknown>;

/** 保存用户配置：仅更新传入字段，未传字段沿用当前库内值；密钥留空不覆盖 */
export function saveUserConfigs(
  userId: string,
  cfg: ConfigInput,
): void {
  const currentRow = db
    .prepare("SELECT * FROM user_configs WHERE user_id = ?")
    .get(userId) as Record<string, unknown> | undefined;

  const str =
    (cfgKey: string, column: string, fallback: string) =>
    (typeof cfg[cfgKey] === "string" ? (cfg[cfgKey] as string) : String(currentRow?.[column] ?? fallback));
  const bool =
    (cfgKey: string, column: string, fallback: number) =>
    typeof cfg[cfgKey] === "boolean"
      ? cfg[cfgKey]
        ? 1
        : 0
      : Number(currentRow?.[column] ?? fallback);
  const num =
    (cfgKey: string, column: string, fallback: number) =>
    typeof cfg[cfgKey] === "number"
      ? (cfg[cfgKey] as number)
      : Number(currentRow?.[column] ?? fallback);
  /** API Key 类字段：传入非空字符串才更新，否则沿用旧值（实现"留空不变"） */
  const secret =
    (cfgKey: string, column: string) =>
    typeof cfg[cfgKey] === "string" && (cfg[cfgKey] as string).trim() !== ""
      ? (cfg[cfgKey] as string).trim()
      : String(currentRow?.[column] || "");

  const logoText = str("logoText", "logo_text", "Navelix");
  const logoImage = str("logoImage", "logo_image", "");
  const showSearchBar = bool("showSearchBar", "show_search_bar", 1);
  const maxWidth = str("maxWidth", "max_width", "1200px");
  const customFooter = str("customFooter", "custom_footer", "© 2026 Navelix. 保留所有权利。");
  const theme = str("theme", "theme", "system");
  const searchEngine = str("searchEngine", "search_engine", "google");
  const aiBaseUrl = str("aiBaseUrl", "ai_base_url", "https://api.openai.com/v1");
  const aiApiKey = secret("aiApiKey", "ai_api_key");
  const aiModel = str("aiModel", "ai_model", "gpt-4o-mini");
  const siteTitle = str("siteTitle", "site_title", "Navelix · Personal Digital Hub");
  const linkStatusEnabled = bool("linkStatusEnabled", "link_status_enabled", 1);
  const linkStatusInterval = num("linkStatusInterval", "link_status_interval", 60);
  const socialGithub = str("socialGithub", "social_github", "");
  const socialX = str("socialX", "social_x", "");
  const socialLinkedin = str("socialLinkedin", "social_linkedin", "");
  const socialEmail = str("socialEmail", "social_email", "");
  const weatherEnabled = bool("weatherEnabled", "weather_enabled", 0);
  const weatherApiKey = secret("weatherApiKey", "weather_api_key");
  const weatherLocation = str("weatherLocation", "weather_location", "");
  const weatherApiBaseUrl = str("weatherApiBaseUrl", "weather_api_base_url", "https://api.seniverse.com");
  const isPro = bool("isPro", "is_pro", 0);
  const linkOpenTarget = str("linkOpenTarget", "link_open_target", "_blank");
  const wallpaperMode = str("wallpaperMode", "wallpaper_mode", "none");
  const customWallpaperUrl = str("customWallpaperUrl", "custom_wallpaper_url", "");
  const glassmorphism = bool("glassmorphism", "glassmorphism", 0);
  const sidebarDefaultState = str("sidebarDefaultState", "sidebar_default_state", "expanded");
  const clockWidgetMode = str("clockWidgetMode", "clock_widget_mode", "time");
  const allowPublicAccess = bool("allowPublicAccess", "allow_public_access", 1);
  const allowRegistration = bool("allowRegistration", "allow_registration", 1);
  const customSearchName = str("customSearchName", "custom_search_name", "");
  const customSearchUrl = str("customSearchUrl", "custom_search_url", "");
  const customHeadScripts = str("customHeadScripts", "custom_head_scripts", "");
  const customCss = str("customCss", "custom_css", "");
  const sensenovaEnabled = bool("sensenovaEnabled", "sensenova_enabled", 0);
  const sensenovaUsername = secret("sensenovaUsername", "sensenova_username");
  const sensenovaPassword = secret("sensenovaPassword", "sensenova_password");
  const sensenovaAccountId = str("sensenovaAccountId", "sensenova_account_id", "");
  const sensenovaTokenKey = secret("sensenovaTokenKey", "sensenova_token_key");

  // 对敏感密钥字段应用 AES-256-GCM 静态落盘加密
  const encryptedAiApiKey = encryptSecret(aiApiKey);
  const encryptedWeatherApiKey = encryptSecret(weatherApiKey);
  const encryptedSensenovaPassword = encryptSecret(sensenovaPassword);
  const encryptedSensenovaTokenKey = encryptSecret(sensenovaTokenKey);

  // 安全告警：自定义脚本/CSS 会绕过 CSP 直接注入到所有访客页面。
  // 此处仅记录日志供运维审计；写入权限已由 POST /api/user/data 的 admin 角色门禁收口。
  if (customHeadScripts.trim() !== "") {
    console.warn(
      "[Security] user_configs.custom_head_scripts 已写入非空内容，将以 dangerouslySetInnerHTML 注入页面（绕过 CSP），请确保来源可信且仅管理员可配置。",
    );
  }
  if (customCss.trim() !== "") {
    console.warn(
      "[Security] user_configs.custom_css 已写入非空内容，将以 <style> 注入页面（绕过 CSP style-src），请确保来源可信且仅管理员可配置。",
    );
  }

  db.prepare(`
    INSERT OR REPLACE INTO user_configs (
      user_id, logo_text, logo_image, show_search_bar, max_width, custom_footer, theme,
      search_engine, ai_base_url, ai_api_key, ai_model, site_title, link_status_enabled,
      link_status_interval, social_github, social_x, social_linkedin, social_email,
      weather_enabled, weather_api_key, weather_location, weather_api_base_url, is_pro,
      link_open_target, wallpaper_mode, custom_wallpaper_url, glassmorphism,
      sidebar_default_state, clock_widget_mode, allow_public_access, allow_registration,
      custom_search_name, custom_search_url, custom_head_scripts, custom_css,
      sensenova_enabled, sensenova_username, sensenova_password, sensenova_account_id, sensenova_token_key
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    encryptedAiApiKey,
    aiModel,
    siteTitle,
    linkStatusEnabled,
    linkStatusInterval,
    socialGithub,
    socialX,
    socialLinkedin,
    socialEmail,
    weatherEnabled,
    encryptedWeatherApiKey,
    weatherLocation,
    weatherApiBaseUrl,
    isPro,
    linkOpenTarget,
    wallpaperMode,
    customWallpaperUrl,
    glassmorphism,
    sidebarDefaultState,
    clockWidgetMode,
    allowPublicAccess,
    allowRegistration,
    customSearchName,
    customSearchUrl,
    customHeadScripts,
    customCss,
    sensenovaEnabled,
    sensenovaUsername,
    encryptedSensenovaPassword,
    sensenovaAccountId,
    encryptedSensenovaTokenKey,
  );

  // 记录关键配置变更安全审计日志
  if (aiApiKey && aiApiKey !== String(currentRow?.ai_api_key || "")) {
    recordAuditLog({
      userId,
      action: "config.ai_key.update",
      target: "user_configs",
      details: "更新了 AI API Key",
    });
  }
}