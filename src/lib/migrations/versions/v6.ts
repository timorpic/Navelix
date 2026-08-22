import type { DatabaseSync } from "node:sqlite";

/**
 * v6：一次性迁移 —— 清理并重置旧版本 SELECT * 引起的 user_configs 列错位。
 */
export function migrateV6(db: DatabaseSync): void {
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
}