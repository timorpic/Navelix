/** Shared by the browser and server. No runtime/server imports. */
export const LOG_CATEGORIES = {
  security: { zh: "账号与安全", en: "Accounts & security" },
  system: { zh: "系统管理", en: "System management" },
  navigation: { zh: "网址导航", en: "Bookmarks & navigation" },
  workspace: { zh: "项目与日程", en: "Projects & calendar" },
  ai: { zh: "AI 助手", en: "AI assistant" },
  notification: { zh: "通知与推送", en: "Notifications & delivery" },
  backup: { zh: "备份与恢复", en: "Backup & restore" },
  runtime: { zh: "系统运行", en: "System runtime" },
} as const;
export type LogCategory = keyof typeof LOG_CATEGORIES;
export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogOutcome = "started" | "succeeded" | "failed" | "cancelled" | "skipped" | "exhausted" | "unknown";
export interface LogEvent {
  id: string;
  schemaVersion: 1;
  timestamp: number;
  category: LogCategory;
  module: string;
  event: string;
  kind: "audit" | "business" | "runtime" | "request";
  level: LogLevel;
  outcome: LogOutcome;
  actorType: "user" | "system" | "anonymous";
  actorId: string;
  subjectType: string;
  subjectId: string;
  requestId: string;
  operationId: string;
  parentId: string;
  message: string;
  code: string;
  durationMs: number;
  source: "web" | "api" | "scheduler" | "frontend" | "system";
  appVersion: string;
  instanceId: string;
  details: Record<string, unknown>;
}
export interface LogInput {
  category: LogCategory;
  event: string;
  module?: string;
  kind?: LogEvent["kind"];
  level?: LogLevel;
  outcome?: LogOutcome;
  actorId?: string;
  actorType?: LogEvent["actorType"];
  subjectType?: string;
  subjectId?: string;
  operationId?: string;
  parentId?: string;
  message?: string;
  code?: string;
  durationMs?: number;
  source?: LogEvent["source"];
  details?: Record<string, unknown>;
}
export interface LogSettings {
  level: "info" | "debug";
  debugUntil: number;
  auditRetentionDays: 0 | 90 | 180 | 365;
  runtimeRetentionDays: number;
  businessRetentionDays: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  frontendEnabled: boolean;
  alertsEnabled: boolean;
  categories: Record<LogCategory, boolean>;
}
export interface LogFilter {
  category?: LogCategory;
  module?: string;
  level?: LogLevel;
  outcome?: LogOutcome;
  kind?: LogEvent["kind"];
  actorId?: string;
  source?: LogEvent["source"];
  event?: string;
  q?: string;
  requestId?: string;
  operationId?: string;
  from: number;
  to: number;
}
export interface LogPage {
  /** Matching records in the bounded scan; may be incomplete when partial is true. */
  total: number;
  logs: LogEvent[];
  nextCursor: string | null;
  partial: boolean;
  warnings: string[];
}

export interface LogCleanupPreview {
  token: string;
  expiresAt: number;
  auditCount: number;
  files: number;
  bytes: number;
  settings: LogSettings;
}
export interface LogCleanupResult {
  auditCount: number;
  removed: number;
  releasedBytes: number;
  partial: boolean;
}
export interface LogStatistics {
  trend: { time: number; count: number; errors: number }[];
  health: { bytes: number; files: number; dropped: number; readable: boolean; lastErrorAt: number; successfulWriteAt: number };
  auditCount: number;
  errors: { event: string; count: number }[];
  partial: boolean;
}
