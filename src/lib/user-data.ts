import { db, seedUserData } from "./db";
import type { Category, Project, SiteLink, SystemConfig } from "@/types";

export interface UserDataResult {
  categories: Category[];
  links: SiteLink[];
  projects: Project[];
  config: SystemConfig;
}

/** POST 保存后调用，使该用户的缓存失效 */
export function invalidateUserData(_userId?: string): void {
  // SQLite WAL 模式实时读写，无需内存缓存
}

/**
 * 服务端获取用户的完整数据（分类、链接、项目、配置）。
 * 用于 SSR 预取：在 Layout 中调用，数据通过 props 传给客户端 Provider。
 * 直接实时查询 SQLite（<0.2ms），确保新增、编辑、删除链接后刷新页面 100% 实时生效。
 */
export function getUserData(userId: string): UserDataResult {

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
      `SELECT id, name, status_color, sort_order
       FROM projects
       WHERE user_id = ?
       ORDER BY sort_order ASC`,
    )
    .all(userId) as Array<{
    id: string;
    name: string;
    status_color: string;
    sort_order: number;
  }>;

  const projects: Project[] = projectRows.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.status_color || "#00C776",
    sortOrder: p.sort_order,
  }));

  // Fetch config
  const configRow = db
    .prepare("SELECT * FROM user_configs WHERE user_id = ?")
    .get(userId) as Record<string, unknown> | undefined;

  const config: SystemConfig = configRow
    ? {
        logoText: String(configRow.logo_text || "Navelix"),
        logoImage: String(configRow.logo_image || ""),
        showSearchBar: configRow.show_search_bar === 1,
        maxWidth: (configRow.max_width as SystemConfig["maxWidth"]) || "1200px",
        customFooter: String(configRow.custom_footer || "© 2026 Navelix. 保留所有权利。"),
        theme: (configRow.theme as SystemConfig["theme"]) || "system",
        searchEngine: (configRow.search_engine as SystemConfig["searchEngine"]) || "google",
        aiBaseUrl: String(configRow.ai_base_url || "https://api.openai.com/v1"),
        // 安全：不下发明文密钥，仅返回是否已配置标记
        aiKeyConfigured: Boolean(configRow.ai_api_key),
        aiModel: String(configRow.ai_model || "gpt-4o-mini"),
        siteTitle: String(configRow.site_title || "Navelix · Personal Digital Hub"),
        linkStatusEnabled: configRow.link_status_enabled === 1,
        linkStatusInterval: Number(configRow.link_status_interval) || 60,
        socialGithub: String(configRow.social_github || ""),
        socialX: String(configRow.social_x || ""),
        socialLinkedin: String(configRow.social_linkedin || ""),
        socialEmail: String(configRow.social_email || ""),
        weatherEnabled: configRow.weather_enabled === 1,
        weatherKeyConfigured: Boolean(configRow.weather_api_key),
        weatherLocation: String(configRow.weather_location || ""),
        weatherApiBaseUrl: String(configRow.weather_api_base_url || "https://api.seniverse.com"),
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
        socialGithub: "",
        socialX: "",
        socialLinkedin: "",
        socialEmail: "",
        weatherEnabled: false,
        weatherKeyConfigured: false,
        weatherLocation: "",
        weatherApiBaseUrl: "https://api.seniverse.com",
      };

  const result: UserDataResult = { categories: categoryRows as Category[], links, projects, config };
  // SQLite 返回的行对象原型非标准（null 原型），
  // Next.js 要求传给客户端组件的数据必须是纯对象，深拷贝处理。
  return JSON.parse(JSON.stringify(result)) as UserDataResult;
}