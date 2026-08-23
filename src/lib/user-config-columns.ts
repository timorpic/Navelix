import type { DatabaseSync } from "node:sqlite";
import type { SystemConfig } from "@/types";
import { ensureColumn } from "./migrations/shared.ts";
import {
  DEFAULT_CUSTOM_FOOTER,
  DEFAULT_SITE_TITLE,
} from "./constants.ts";

/**
 * user_configs 表的元数据驱动列定义 —— 单一事实来源。
 *
 * 历史问题：每次新增一个配置项需要在 3+ 处手动同步
 * （db/schema.ts 的 CREATE TABLE、migrations/schema.ts 的 ensureColumn、
 *  migrations.test.ts 的断言，以及 user-data.ts 的读/写映射），极易漏改。
 *
 * 现在只需在此数组新增一行，CREATE TABLE / ensureColumn / 测试断言 /
 * 读映射（mapUserConfigRow / defaultUserConfig）/ 写映射（coerceUserConfigValues）
 * 全部自动生成，加列成本收敛为一次。
 */
export type UserConfigKind = "bool" | "num" | "str" | "secret";

export interface UserConfigColumnDef {
  /** SQLite 列名（snake_case） */
  column: string;
  /** 完整 SQL 列定义（CREATE TABLE 与 ensureColumn 共用） */
  def: string;
  /** 仅当该列在旧库中补齐时使用不同的定义（与 def 不一致的历史特例） */
  ensureDef?: string;
  /** 映射到 SystemConfig 的字段名；缺省 = 仅存储，不暴露给前端 */
  configKey?: keyof SystemConfig;
  /** 值映射类型：bool/num/str/secret（secret 明文永不下发，仅派生已配置标记） */
  kind?: UserConfigKind;
  /** 读取兜底默认值（无配置行或列值缺省时使用） */
  configDefault?: boolean | string | number;
  /** secret 列派生出的「已配置」标记字段 */
  configuredFlag?: keyof SystemConfig;
  /** 仅管理员可写；非管理员写回时保持库内原值 */
  adminOnly?: boolean;
  /** 写回时是否对值做 AES-256-GCM 静态落盘加密（secret 列） */
  encrypt?: boolean;
}

/**
 * 全部 user_configs 列（除主键 user_id）。
 * 顺序同时决定 CREATE TABLE 与 upsert 语句的列序，仅影响可读性。
 */
export const USER_CONFIG_COLUMNS: UserConfigColumnDef[] = [
  // ── 品牌与外观 ──
  {
    column: "logo_text",
    def: "logo_text TEXT NOT NULL DEFAULT 'Navelix'",
    configKey: "logoText",
    kind: "str",
    configDefault: "Navelix",
  },
  {
    column: "logo_image",
    def: "logo_image TEXT NOT NULL DEFAULT ''",
    configKey: "logoImage",
    kind: "str",
    configDefault: "",
  },
  {
    column: "show_search_bar",
    def: "show_search_bar INTEGER NOT NULL DEFAULT 1",
    configKey: "showSearchBar",
    kind: "bool",
    configDefault: true,
  },
  {
    column: "max_width",
    def: "max_width TEXT NOT NULL DEFAULT '1200px'",
    configKey: "maxWidth",
    kind: "str",
    configDefault: "1200px",
  },
  {
    column: "custom_footer",
    def: `custom_footer TEXT NOT NULL DEFAULT '${DEFAULT_CUSTOM_FOOTER}'`,
    configKey: "customFooter",
    kind: "str",
    configDefault: DEFAULT_CUSTOM_FOOTER,
  },
  // 仅存储列（历史遗留，不映射到前端配置）
  { column: "language", def: "language TEXT NOT NULL DEFAULT 'zh'", kind: "str" },
  {
    column: "theme",
    def: "theme TEXT NOT NULL DEFAULT 'light'",
    configKey: "theme",
    kind: "str",
    configDefault: "system",
  },

  // ── AI 配置 ──
  {
    column: "ai_base_url",
    def: "ai_base_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1'",
    configKey: "aiBaseUrl",
    kind: "str",
    configDefault: "https://api.openai.com/v1",
  },
  {
    column: "ai_api_key",
    def: "ai_api_key TEXT NOT NULL DEFAULT ''",
    configKey: "aiApiKey",
    kind: "secret",
    configuredFlag: "aiKeyConfigured",
    encrypt: true,
  },
  {
    column: "ai_model",
    def: "ai_model TEXT NOT NULL DEFAULT 'gpt-4o-mini'",
    configKey: "aiModel",
    kind: "str",
    configDefault: "gpt-4o-mini",
  },
  {
    column: "site_title",
    def: `site_title TEXT NOT NULL DEFAULT '${DEFAULT_SITE_TITLE}'`,
    configKey: "siteTitle",
    kind: "str",
    configDefault: DEFAULT_SITE_TITLE,
  },

  // ── 链接状态监控（网络探针）──
  {
    column: "link_status_enabled",
    def: "link_status_enabled INTEGER NOT NULL DEFAULT 1",
    configKey: "linkStatusEnabled",
    kind: "bool",
    configDefault: false,
  },
  {
    column: "link_status_interval",
    def: "link_status_interval INTEGER NOT NULL DEFAULT 60",
    configKey: "linkStatusInterval",
    kind: "num",
    configDefault: 60,
  },

  // ── 社交链接 ──
  {
    column: "social_github",
    def: "social_github TEXT NOT NULL DEFAULT ''",
    configKey: "socialGithub",
    kind: "str",
    configDefault: "",
  },
  {
    column: "social_x",
    def: "social_x TEXT NOT NULL DEFAULT ''",
    configKey: "socialX",
    kind: "str",
    configDefault: "",
  },
  {
    column: "social_linkedin",
    def: "social_linkedin TEXT NOT NULL DEFAULT ''",
    configKey: "socialLinkedin",
    kind: "str",
    configDefault: "",
  },
  {
    column: "social_email",
    def: "social_email TEXT NOT NULL DEFAULT ''",
    configKey: "socialEmail",
    kind: "str",
    configDefault: "",
  },

  // ── 天气模块 ──
  {
    column: "weather_enabled",
    def: "weather_enabled INTEGER NOT NULL DEFAULT 0",
    configKey: "weatherEnabled",
    kind: "bool",
    configDefault: false,
  },
  {
    column: "weather_api_key",
    def: "weather_api_key TEXT NOT NULL DEFAULT ''",
    configKey: "weatherApiKey",
    kind: "secret",
    configuredFlag: "weatherKeyConfigured",
    encrypt: true,
  },
  {
    column: "weather_location",
    def: "weather_location TEXT NOT NULL DEFAULT ''",
    configKey: "weatherLocation",
    kind: "str",
    configDefault: "",
  },
  {
    column: "weather_api_base_url",
    def: "weather_api_base_url TEXT NOT NULL DEFAULT 'https://api.seniverse.com'",
    configKey: "weatherApiBaseUrl",
    kind: "str",
    configDefault: "https://api.seniverse.com",
  },

  // ── 更多个性化外观 ──
  {
    column: "link_open_target",
    def: "link_open_target TEXT NOT NULL DEFAULT '_blank'",
    configKey: "linkOpenTarget",
    kind: "str",
    configDefault: "_blank",
  },
  {
    column: "wallpaper_mode",
    def: "wallpaper_mode TEXT NOT NULL DEFAULT 'none'",
    configKey: "wallpaperMode",
    kind: "str",
    configDefault: "none",
  },
  {
    column: "custom_wallpaper_url",
    def: "custom_wallpaper_url TEXT NOT NULL DEFAULT ''",
    configKey: "customWallpaperUrl",
    kind: "str",
    configDefault: "",
  },
  {
    column: "glassmorphism",
    def: "glassmorphism INTEGER NOT NULL DEFAULT 0",
    configKey: "glassmorphism",
    kind: "bool",
    configDefault: false,
  },
  {
    column: "sidebar_default_state",
    def: "sidebar_default_state TEXT NOT NULL DEFAULT 'expanded'",
    configKey: "sidebarDefaultState",
    kind: "str",
    configDefault: "expanded",
  },
  {
    column: "clock_widget_mode",
    def: "clock_widget_mode TEXT NOT NULL DEFAULT 'time'",
    configKey: "clockWidgetMode",
    kind: "str",
    configDefault: "time",
  },

  // ── 访问与安全策略（仅管理员可写）──
  {
    column: "allow_public_access",
    def: "allow_public_access INTEGER NOT NULL DEFAULT 0",
    configKey: "allowPublicAccess",
    kind: "bool",
    configDefault: false,
    adminOnly: true,
  },
  {
    column: "allow_registration",
    def: "allow_registration INTEGER NOT NULL DEFAULT 0",
    configKey: "allowRegistration",
    kind: "bool",
    configDefault: false,
    adminOnly: true,
  },
  {
    column: "security_setup_done",
    def: "security_setup_done INTEGER NOT NULL DEFAULT 0",
    configKey: "securitySetupDone",
    kind: "bool",
    configDefault: false,
  },

  // ── 自定义脚本与样式注入（仅管理员，绕过 CSP）──
  {
    column: "custom_head_scripts",
    def: "custom_head_scripts TEXT NOT NULL DEFAULT ''",
    configKey: "customHeadScripts",
    kind: "str",
    configDefault: "",
  },
  {
    column: "custom_css",
    def: "custom_css TEXT NOT NULL DEFAULT ''",
    configKey: "customCss",
    kind: "str",
    configDefault: "",
  },

  // ── 右侧边栏小组件开关 ──
  {
    column: "model_monitor_enabled",
    def: "model_monitor_enabled INTEGER NOT NULL DEFAULT 1",
    configKey: "modelMonitorEnabled",
    kind: "bool",
    configDefault: true,
  },
  {
    column: "ai_copilot_enabled",
    def: "ai_copilot_enabled INTEGER NOT NULL DEFAULT 1",
    configKey: "aiCopilotEnabled",
    kind: "bool",
    configDefault: true,
  },
  {
    column: "today_activity_enabled",
    def: "today_activity_enabled INTEGER NOT NULL DEFAULT 1",
    configKey: "todayActivityEnabled",
    kind: "bool",
    configDefault: true,
  },
  {
    column: "recent_visits_enabled",
    def: "recent_visits_enabled INTEGER NOT NULL DEFAULT 1",
    configKey: "recentVisitsEnabled",
    kind: "bool",
    configDefault: true,
  },
  {
    column: "pending_reminders_enabled",
    def: "pending_reminders_enabled INTEGER NOT NULL DEFAULT 0",
    configKey: "pendingRemindersEnabled",
    kind: "bool",
    configDefault: false,
  },
  {
    column: "today_summary_enabled",
    def: "today_summary_enabled INTEGER NOT NULL DEFAULT 0",
    configKey: "todaySummaryEnabled",
    kind: "bool",
    configDefault: false,
  },
  {
    column: "social_links_enabled",
    def: "social_links_enabled INTEGER NOT NULL DEFAULT 1",
    configKey: "socialLinksEnabled",
    kind: "bool",
    configDefault: true,
  },
];

/** 全部列名（用于迁移完整性测试等） */
export const USER_CONFIG_COLUMN_NAMES: string[] = USER_CONFIG_COLUMNS.map(
  (c) => c.column,
);

/** 可读写映射到 SystemConfig 的列（排除仅存储列） */
export const USER_CONFIG_MAPPED_COLUMNS: UserConfigColumnDef[] =
  USER_CONFIG_COLUMNS.filter((c) => c.configKey);

/** 生成初次建表的 CREATE TABLE 语句（db/schema.ts 使用） */
export function createUserConfigsTableSql(): string {
  const cols = USER_CONFIG_COLUMNS.map((c) => `    ${c.def}`).join(",\n");
  return `CREATE TABLE IF NOT EXISTS user_configs (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
${cols}
  );`;
}

/**
 * 幂等补齐 user_configs 全部缺失列（migrations/schema.ts 使用）。
 * 多次调用安全：ensureColumn 内部会跳过已存在的列。
 */
export function ensureUserConfigColumns(db: DatabaseSync): void {
  for (const col of USER_CONFIG_COLUMNS) {
    ensureColumn(db, "user_configs", col.column, col.ensureDef ?? col.def);
  }
}

/** 布尔/数字/字符串值统一读取为布尔（兼容 1/true/"1"） */
function toBool(v: unknown): boolean {
  return v === 1 || v === true || v === "1";
}

/**
 * 读取映射：将 user_configs 行转换为 SystemConfig 片段。
 * 仅映射有 configKey 的列；secret 列明文不下发，仅派生「已配置」标记。
 * 行为与 user-data.ts / api/user/data/route.ts 的旧手写映射完全一致。
 */
export function mapUserConfigRow(
  row?: Record<string, unknown>,
): Partial<SystemConfig> {
  const cfg: Record<string, unknown> = {};
  for (const col of USER_CONFIG_MAPPED_COLUMNS) {
    const v = row?.[col.column];
    switch (col.kind) {
      case "secret":
        if (col.configuredFlag) cfg[col.configuredFlag] = Boolean(v);
        break;
      case "bool":
        cfg[col.configKey!] = toBool(v);
        break;
      case "num":
        cfg[col.configKey!] = Number(v) || Number(col.configDefault);
        break;
      case "str":
      default:
        cfg[col.configKey!] = String(v || col.configDefault);
        break;
    }
  }
  return cfg as Partial<SystemConfig>;
}

/** 无配置行时的默认 SystemConfig（与旧 else 分支一致） */
export function defaultUserConfig(): SystemConfig {
  const cfg: Record<string, unknown> = {};
  for (const col of USER_CONFIG_MAPPED_COLUMNS) {
    if (col.kind === "secret") {
      if (col.configuredFlag) cfg[col.configuredFlag] = false;
      continue;
    }
    cfg[col.configKey!] = col.configDefault;
  }
  return cfg as unknown as SystemConfig;
}

/** 生成 saveUserConfigs 使用的 upsert SQL（user_id 为冲突键） */
export function buildUserConfigsUpsertSql(): string {
  const cols = USER_CONFIG_MAPPED_COLUMNS.map((c) => c.column);
  const insertCols = ["user_id", ...cols].join(", ");
  const placeholders = ["?", ...cols.map(() => "?")].join(", ");
  const updateSet = cols
    .map((c) => `      ${c} = excluded.${c}`)
    .join(",\n");
  return `INSERT INTO user_configs (${insertCols})
    VALUES (${placeholders})
    ON CONFLICT(user_id) DO UPDATE SET
${updateSet}`;
}

/** 配置输入（宽松类型，运行期逐字段校验；密钥字段留空 = 保持不变） */
export type ConfigInput = Record<string, unknown>;

/**
 * 写回值计算：按列 kind 做安全类型转换（与旧手写 str/bool/num/secret 一致）。
 * - bool：前端布尔 → 1/0；否则沿用库内当前值
 * - num：前端数字 → 原值；否则沿用库内当前值
 * - str：前端字符串 → 原值；否则沿用库内当前值
 * - secret：传入非空字符串才更新（trim），否则沿用库内值
 * - adminOnly：非管理员写回时保持库内原值
 * - encrypt：对 secret 值做 AES-256-GCM 落盘加密
 */
export function coerceUserConfigValues(
  cfg: ConfigInput,
  currentRow: Record<string, unknown> | undefined,
  isAdmin: boolean,
  encrypt: (plain: string) => string,
): (string | number)[] {
  const values: (string | number)[] = [];
  for (const col of USER_CONFIG_MAPPED_COLUMNS) {
    const current = currentRow?.[col.column];
    if (col.adminOnly && !isAdmin) {
      values.push(Number(current ?? 0));
      continue;
    }
    const input = cfg[col.configKey!];
    let v: string | number;
    switch (col.kind) {
      case "bool":
        v =
          typeof input === "boolean"
            ? input
              ? 1
              : 0
            : Number(current ?? (col.configDefault ? 1 : 0));
        break;
      case "num":
        v =
          typeof input === "number"
            ? input
            : Number(current ?? col.configDefault);
        break;
      case "secret":
        v =
          typeof input === "string" && input.trim() !== ""
            ? input.trim()
            : String(current || "");
        if (col.encrypt) v = encrypt(v);
        break;
      case "str":
      default:
        v =
          typeof input === "string"
            ? input
            : String(current ?? col.configDefault);
        break;
    }
    values.push(v);
  }
  return values;
}
