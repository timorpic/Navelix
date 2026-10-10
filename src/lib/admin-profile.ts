/**
 * 「个人账号与安全」Tab（`admin-profile-tab.tsx`，原 1219 行）的纯逻辑。
 *
 * 从该文件下沉 —— 设备名映射、修改密码的三条前端校验、提示颜色判定、
 * 资料表单初值归一化，以及四个接口响应的解析与 Telegram 保存载荷组装，
 * 原先都内联在组件里无法被单测覆盖。本模块不含任何 React 依赖，
 * React 状态与副作用见 `@/hooks/use-admin-profile-account` 等 hook。
 */

export interface ProfileUser {
  username: string;
  displayName: string;
  role: "admin" | "user";
  avatar?: string;
  email?: string;
  bio?: string;
}

export interface ProfileFormInputs {
  displayName: string;
  email: string;
  bio: string;
}

// 会话与 API Token 的条目形状由 auth/ 侧定义（同一批接口的响应契约），
// 此处沿用别名，避免两处各写一份结构相同的 interface。
export type { SessionItem as SessionRow } from "./auth/sessions.ts";
export type { ApiTokenItem as ApiTokenRow } from "./auth/api-tokens.ts";

/** 由 User-Agent 推断设备/浏览器展示名（分支顺序与文案均保持原样）。 */
export function sessionLabel(ua: string): string {
  if (ua.includes("Chrome")) return "🌐 Chrome 浏览器";
  if (ua.includes("Safari")) return "🧭 Safari 浏览器";
  if (ua.includes("Firefox")) return "🦊 Firefox 浏览器";
  return "💻 桌面端终端设备";
}

/** 资料/密码提示的颜色：以 🎉 开头视为成功（品牌绿），否则为失败（玫红）。 */
export function profileNoticeColor(notice: string): string {
  return notice.startsWith("🎉") ? "#00C776" : "#F43F5E";
}

export interface PasswordChangeInput {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export type PasswordChangeCheck = { ok: true } | { ok: false; message: string };

/**
 * 修改密码的前端校验，顺序与原内联实现一致：
 * 原密码非空 → 新密码至少 6 位 → 两次新密码一致。
 */
export function validatePasswordChange(
  input: PasswordChangeInput,
): PasswordChangeCheck {
  if (!input.oldPassword) {
    return { ok: false, message: "❌ 请输入当前原密码" };
  }
  if (!input.newPassword || input.newPassword.length < 6) {
    return { ok: false, message: "❌ 新密码长度至少需 6 位" };
  }
  if (input.newPassword !== input.confirmPassword) {
    return { ok: false, message: "❌ 两次输入的二次确认新密码不一致，请重新检查" };
  }
  return { ok: true };
}

/** 用当前用户填充资料表单初值（displayName 缺失时回退到 username）。 */
export function profileInputsFrom(user: {
  username?: string;
  displayName?: string;
  email?: string;
  bio?: string;
}): ProfileFormInputs {
  return {
    displayName: user.displayName || user.username || "",
    email: user.email || "",
    bio: user.bio || "",
  };
}

/** 解析 GET /api/auth/me 的响应，取不到用户对象时返回 null。 */
export function parseProfileUser(data: unknown): ProfileUser | null {
  if (!data || typeof data !== "object") return null;
  const user = (data as { user?: unknown }).user;
  if (!user || typeof user !== "object") return null;
  return user as ProfileUser;
}

export type ProfileSaveOutcome =
  | { ok: true; user: ProfileUser; notice: string }
  | { ok: false; notice: string };

/** 解析 PATCH /api/auth/profile 的响应，组装成提示文案（成功带 🎉 / 失败带 ❌）。 */
export function parseProfileSaveResult(
  resOk: boolean,
  data: unknown,
): ProfileSaveOutcome {
  const d = (data ?? {}) as { user?: unknown; message?: unknown; error?: unknown };
  if (resOk && d.user && typeof d.user === "object") {
    const message = d.message ? String(d.message) : "个人资料更新成功";
    return { ok: true, user: d.user as ProfileUser, notice: `🎉 ${message}` };
  }
  const error = d.error ? String(d.error) : "修改失败";
  return { ok: false, notice: `❌ ${error}` };
}

export interface TelegramConfigState {
  enabled: boolean;
  notifyBackup: boolean;
  notifySystem: boolean;
  botTokenConfigured: boolean;
  chatId: string;
  chatIdConfigured: boolean;
}

/** 解析 GET /api/admin/telegram 的响应（status 缺失时视为无效响应）。 */
export function parseTelegramConfig(data: unknown): TelegramConfigState | null {
  if (!data || typeof data !== "object") return null;
  const d = data as {
    status?: {
      enabled?: unknown;
      notifyBackup?: unknown;
      notifySystem?: unknown;
      configured?: unknown;
      chatIdConfigured?: unknown;
    };
    chatId?: unknown;
  };
  if (!d.status || typeof d.status !== "object") return null;
  return {
    enabled: Boolean(d.status.enabled),
    notifyBackup: Boolean(d.status.notifyBackup),
    notifySystem: Boolean(d.status.notifySystem),
    botTokenConfigured: Boolean(d.status.configured),
    chatId: typeof d.chatId === "string" ? d.chatId : "",
    chatIdConfigured: Boolean(d.status.chatIdConfigured),
  };
}

export interface TelegramSaveResult {
  botTokenConfigured: boolean;
  chatIdConfigured: boolean;
}

/** 解析 PUT /api/admin/telegram 成功响应里的两个「已配置」标记。 */
export function parseTelegramSaveResult(data: unknown): TelegramSaveResult | null {
  if (!data || typeof data !== "object") return null;
  const status = (data as { status?: unknown }).status;
  if (!status || typeof status !== "object") return null;
  const s = status as { configured?: unknown; chatIdConfigured?: unknown };
  return {
    botTokenConfigured: Boolean(s.configured),
    chatIdConfigured: Boolean(s.chatIdConfigured),
  };
}

export interface TelegramDraft {
  botToken: string;
  chatId: string;
  enabled: boolean;
  notifyBackup: boolean;
  notifySystem: boolean;
}

export type TelegramSavePatch = Partial<TelegramDraft>;

/**
 * Telegram 保存载荷：显式传入 patch 时按 patch 提交（当前所有调用点均如此），
 * 否则回退为整份表单快照。
 */
export function buildTelegramPayload(
  draft: TelegramDraft,
  patch?: TelegramSavePatch,
): TelegramSavePatch {
  if (patch) return patch;
  return {
    botToken: draft.botToken,
    chatId: draft.chatId,
    enabled: draft.enabled,
    notifyBackup: draft.notifyBackup,
    notifySystem: draft.notifySystem,
  };
}

export interface ReportConfigState {
  enabled: boolean;
  endpointConfigured: boolean;
}

/** 解析 GET /api/admin/analytics/report 的响应；enabled 非布尔时视为无效响应。 */
export function parseReportConfig(data: unknown): ReportConfigState | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { enabled?: unknown; endpointConfigured?: unknown };
  if (typeof d.enabled !== "boolean") return null;
  return { enabled: d.enabled, endpointConfigured: Boolean(d.endpointConfigured) };
}

/** 解析 POST /api/admin/analytics/report 的响应，返回服务端确认后的开关值。 */
export function parseReportSaveResult(data: unknown): boolean | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { success?: unknown; enabled?: unknown };
  if (!d.success) return null;
  return Boolean(d.enabled);
}
