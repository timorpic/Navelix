import type { Category, SiteLink, SystemConfig } from "@/types";

/**
 * 「系统运维与安全」Tab（`admin-system-tab.tsx`，原 928 行）的纯逻辑。
 *
 * 从该文件下沉 —— 版本自检结果与各接口响应的解析、全量 JSON 备份的载荷组装
 * 与导入归一化、浏览器本地数据段的读写，原先都内联在组件的 handler 里，
 * 无法被单测覆盖。本模块不含任何 React 依赖，React 状态与副作用见
 * `@/hooks/use-admin-update-check` / `use-admin-antigravity-secret` /
 * `use-admin-db-backup` / `use-admin-data-transfer` / `use-admin-cache-purge`。
 */

// ── 版本自检（块 4：🔄 版本与更新）──

export interface UpdateCheckLocal {
  sourceSha: string | null;
  buildDate: string | null;
  version: string | null;
  isDockerBuild: boolean;
}

export interface UpdateCheckRemote {
  versionTag: string | null;
  title: string | null;
  lastUpdated: string | null;
  releaseNotes?: string | null;
  htmlUrl?: string | null;
}

export interface UpdateCheckResult {
  local: UpdateCheckLocal;
  remote: UpdateCheckRemote | null;
  updateAvailable: boolean | null;
  error: string | null;
}

/** 服务端未回传版本号时展示的内置默认版本。由 scripts/sync-version.mjs 同步。 */
export const FALLBACK_VERSION = "v2.10.1";

/** 版本号展示：缺失时回退内置默认版本，缺少 `v` 前缀时补上。 */
export function versionLabel(version?: string | null): string {
  if (!version) return FALLBACK_VERSION;
  return version.startsWith("v") ? version : `v${version}`;
}

/** 构建时间 / 发布时间的 zh-CN 本地化展示。 */
export function formatUpdateTime(iso: string): string {
  return new Date(iso).toLocaleString("zh-CN");
}

/** 检查更新请求失败时的兜底结果。 */
export function updateCheckFailureResult(): UpdateCheckResult {
  return {
    local: { sourceSha: null, buildDate: null, version: null, isDockerBuild: false },
    remote: null,
    updateAvailable: null,
    error: "检查失败，请稍后重试",
  };
}

// ── 反重力 OAuth 客户端密钥（块 3：🔐 反重力 OAuth 配置）──

export interface AntigravitySecretState {
  isCustomSecret: boolean;
}

/** 解析 GET /api/admin/system-settings 的响应；缺少配置标记时视为无效响应。 */
export function parseAntigravitySettings(data: unknown): AntigravitySecretState | null {
  if (!data || typeof data !== "object") return null;
  const d = data as {
    antigravityClientSecretConfigured?: unknown;
    isCustomSecret?: unknown;
  };
  if (typeof d.antigravityClientSecretConfigured !== "boolean") return null;
  return { isCustomSecret: Boolean(d.isCustomSecret) };
}

/** 解析 PUT /api/admin/system-settings 成功响应里的 isCustomSecret 标记。 */
export function parseAntigravitySaveResult(data: unknown): AntigravitySecretState {
  const d = (data ?? {}) as { isCustomSecret?: unknown };
  return { isCustomSecret: Boolean(d.isCustomSecret) };
}

/** 密钥输入归一化：去除首尾空白（空值由调用方判定为「不保存」）。 */
export function normalizeAntigravitySecret(raw: string): string {
  return raw.trim();
}

/** 保存密钥的提示文案：成功为固定文案，失败取服务端 error。 */
export function antigravitySaveNotice(resOk: boolean, data: unknown): string {
  if (resOk) return "✅ 反重力 OAuth 客户端密钥已保存";
  const d = (data ?? {}) as { error?: unknown };
  return `❌ ${d.error ? String(d.error) : "保存失败"}`;
}

// ── 数据库物理还原（块 5：💾 数据库物理快照与备份还原）──

export interface DbRestoreOutcome {
  ok: boolean;
  /** 卡片内联提示（成功带 ✅ / 失败带 ❌） */
  notice: string;
}

/** 解析 POST /api/admin/backup 的响应，组装还原结果提示。 */
export function parseDbRestoreResult(resOk: boolean, data: unknown): DbRestoreOutcome {
  const d = (data ?? {}) as { message?: unknown; error?: unknown };
  if (resOk) {
    return { ok: true, notice: `✅ ${d.message ? String(d.message) : "数据库已成功还原"}` };
  }
  return { ok: false, notice: `❌ ${d.error ? String(d.error) : "还原失败"}` };
}

// ── 系统存储与缓存清理（块 7：🧹 缓存与系统存储清理）──

export type CachePurgeTarget = "all" | "notifications" | "vacuum";

export interface CachePurgeOutcome {
  ok: boolean;
  /** 卡片内联提示（成功带 ✅ / 失败带 ❌） */
  notice: string;
  /** 成功时写入通知中心的文案 */
  message: string;
}

/** 解析 POST /api/admin/cache-purge 的响应，组装内联提示与通知中心文案。 */
export function parseCachePurgeResult(resOk: boolean, data: unknown): CachePurgeOutcome {
  const d = (data ?? {}) as { message?: unknown; error?: unknown };
  if (resOk) {
    const message = d.message ? String(d.message) : "清理完成";
    return { ok: true, notice: `✅ ${message}`, message };
  }
  return { ok: false, notice: `❌ ${d.error ? String(d.error) : "清理失败"}`, message: "" };
}

// ── 全量 JSON 备份导出 / 导入（块 6：📦 配置与数据导入导出）──

export const FOCUS_TRACKER_KEY = "navelix.focus.tracker.v1";
export const QUICK_NOTES_KEY = "navelix.quick.notes";
export const LINK_USAGE_KEY = "navelix.link.usage";

/** 导出文件里携带的浏览器本地数据段（结构未知，原样透传）。 */
export interface LocalBackupState {
  focusTracker: unknown;
  quickNotes: unknown;
  linkUsage: unknown;
}

export interface FullExportPayload {
  version: string;
  exportTime: string;
  categories: Category[];
  links: SiteLink[];
  projects: unknown[];
  todos: unknown[];
  config: unknown;
  localStorageData: LocalBackupState;
}

/**
 * 复制配置并剔除两个明文密钥字段。
 * 导出与导入共用同一份剔除规则（导入方自带密钥不应覆盖当前配置）。
 */
export function stripConfigSecrets<T>(config: T): T {
  const safe = { ...(config as Record<string, unknown>) };
  delete safe.aiApiKey;
  delete safe.weatherApiKey;
  return safe as T;
}

export interface FullExportInput {
  /** GET /api/user/data 的响应（解析失败时为空对象） */
  dbData: {
    categories?: Category[];
    links?: SiteLink[];
    projects?: unknown[];
    todos?: unknown[];
    config?: unknown;
  };
  /** 接口未返回时回退到当前页面的配置与数据 */
  fallbackConfig: unknown;
  fallbackCategories: Category[];
  fallbackLinks: SiteLink[];
  localStorageData: LocalBackupState;
  /** 便于测试注入固定导出时间 */
  now?: Date;
}

/** 组装全量导出载荷（字段取值顺序与重构前的内联实现一致）。 */
export function buildFullExportPayload(input: FullExportInput): FullExportPayload {
  const { dbData, fallbackConfig, fallbackCategories, fallbackLinks, localStorageData } = input;
  return {
    version: "2.0",
    exportTime: (input.now ?? new Date()).toISOString(),
    categories: dbData.categories || fallbackCategories,
    links: dbData.links || fallbackLinks,
    projects: dbData.projects || [],
    todos: dbData.todos || [],
    config: stripConfigSecrets(dbData.config || fallbackConfig),
    localStorageData,
  };
}

/** 导出文件名（毫秒时间戳）。 */
export function fullBackupFileName(now: Date = new Date()): string {
  return `navelix-full-backup-${Math.floor(now.getTime())}.json`;
}

/** 导出成功后的通知中心文案。 */
export function fullExportSummary(
  payload: Pick<FullExportPayload, "categories" | "links" | "projects" | "todos">,
): string {
  return `全量数据导出成功：包含 ${payload.links.length} 链接、${payload.categories.length} 分组、${payload.projects.length} 项目、${payload.todos.length} 日程`;
}

export interface FullImportPayload {
  categories: Category[];
  links: SiteLink[];
  projects: unknown[];
  todos: unknown[];
  config?: Partial<SystemConfig>;
  localStorageData: Partial<LocalBackupState> | null;
}

/**
 * 归一化导入的 JSON：分类 / 链接按必填字段过滤（谓词与重构前逐字一致），
 * 项目 / 日程原样透传，配置剔除明文密钥。
 */
export function parseFullImportPayload(parsed: unknown): FullImportPayload {
  const p = (parsed ?? {}) as {
    categories?: unknown;
    links?: unknown;
    projects?: unknown;
    todos?: unknown;
    config?: unknown;
    localStorageData?: unknown;
  };

  const categories: Category[] = Array.isArray(p.categories)
    ? p.categories.filter(
        (c: { id?: unknown; name?: unknown }) =>
          c && typeof c.id === "string" && typeof c.name === "string",
      )
    : [];
  const links: SiteLink[] = Array.isArray(p.links)
    ? p.links.filter(
        (l: { id?: unknown; title?: unknown; url?: unknown }) =>
          l &&
          typeof l.id === "string" &&
          typeof l.title === "string" &&
          typeof l.url === "string",
      )
    : [];
  const projects: unknown[] = Array.isArray(p.projects) ? p.projects : [];
  const todos: unknown[] = Array.isArray(p.todos) ? p.todos : [];

  return {
    categories,
    links,
    projects,
    todos,
    config: p.config ? (stripConfigSecrets(p.config) as Partial<SystemConfig>) : undefined,
    localStorageData: p.localStorageData
      ? (p.localStorageData as Partial<LocalBackupState>)
      : null,
  };
}

/** 导入成功后的通知中心文案。 */
export function fullImportSummary(
  payload: Pick<FullImportPayload, "categories" | "links" | "projects" | "todos">,
): string {
  return `全网全量配置导入成功：恢复 ${payload.links.length} 链接、${payload.categories.length} 分组、${payload.projects.length} 项目、${payload.todos.length} 日程`;
}

/** 读取浏览器本地数据段（解析失败按 null，与重构前逐项 try/catch 等价）。 */
export function readLocalExportState(storage: Pick<Storage, "getItem">): LocalBackupState {
  return {
    focusTracker: readJsonOrNull(storage, FOCUS_TRACKER_KEY),
    quickNotes: readJsonOrNull(storage, QUICK_NOTES_KEY),
    linkUsage: readJsonOrNull(storage, LINK_USAGE_KEY),
  };
}

function readJsonOrNull(storage: Pick<Storage, "getItem">, key: string): unknown {
  try {
    return JSON.parse(storage.getItem(key) || "null");
  } catch {
    return null;
  }
}

/** 把备份里的本地数据段写回浏览器（各字段按真值判断，与重构前一致）。 */
export function writeLocalExportState(
  storage: Pick<Storage, "setItem">,
  data: Partial<LocalBackupState> | null | undefined,
): void {
  if (!data) return;
  if (data.focusTracker) {
    storage.setItem(FOCUS_TRACKER_KEY, JSON.stringify(data.focusTracker));
  }
  if (data.quickNotes) {
    storage.setItem(QUICK_NOTES_KEY, JSON.stringify(data.quickNotes));
  }
  if (data.linkUsage) {
    storage.setItem(LINK_USAGE_KEY, JSON.stringify(data.linkUsage));
  }
}

/** 书签导入成功的通知中心文案。 */
export function bookmarkImportSummary(counts: { categories: number; links: number }): string {
  return `书签导入成功：合并添加 ${counts.links} 个链接`;
}

/** Sun-Panel 配置导入成功的通知中心文案。 */
export function sunPanelImportSummary(counts: { categories: number; links: number }): string {
  return `☀️ Sun-Panel 配置导入成功：解析并合并导入 ${counts.links} 个链接与 ${counts.categories} 个分组`;
}
