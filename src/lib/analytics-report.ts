import { db } from "./db.ts";
import { getSystemSetting, setSystemSetting } from "./system-settings.ts";
import {
  EVENT_MODULES,
  VALUE_MOMENT_EVENTS,
  getAnalyticsInstanceId,
  isAnalyticsEnabled,
} from "./analytics.ts";
import { safeFetch } from "./ssrf.ts";
import { getBuildInfo } from "./build-info.ts";
import fs from "node:fs";

/**
 * 检测是否运行在 Docker 容器内。
 * 优先看 /.dockerenv（Docker 容器的标准标记，容器内必然存在），
 * 其次兜底环境变量（DOCKER / NAVELIX_DOCKER，官方 Dockerfile 未设置，仅兼容手动注入）。
 * 注意：不可依赖 process.env.DOCKER——Docker 不会自动注入该变量。
 */
function isDockerRuntime(): boolean {
  try {
    if (fs.existsSync("/.dockerenv")) return true;
  } catch {
    // 忽略文件系统异常
  }
  return Boolean(process.env.DOCKER || process.env.NAVELIX_DOCKER);
}

/**
 * M1 每周匿名聚合上报（规范：wiki/Analytics-使用统计与埋点规范.md §10）。
 *
 * 设计要点：
 *   - 只上报聚合计数，绝不包含用户 ID / IP / 时间戳明细 / meta 载荷
 *   - 默认开启（NAVELIX_ANALYTICS_REPORT=on|off，DB 开关可覆盖），界面零展现
 *   - 端点可配置（NAVELIX_ANALYTICS_ENDPOINT 环境变量 > 内置默认端点）
 *   - 每周至多 1 次，按「本周一」去重（analytics_last_report_week）
 *   - 失败静默且不删本地事件；下周一自然重发（去重键未更新）
 *   - 上报只读本地聚合副本，绝不改写 analytics_events
 */

/**
 * 遥测配置（端点 + TOKEN）来源（优先级从高到低）：
 *   1. 环境变量 NAVELIX_ANALYTICS_ENDPOINT / NAVELIX_ANALYTICS_TOKEN（部署方可覆盖）
 *   2. ee 字节码制品（ee/dist/bundle.jsc 中的 telemetrySecret，源码在 /ee/ 不推送 GitHub）
 *   3. 无默认值——公共源码不含任何敏感信息
 * 说明：遥测上报对所有实例（CE/Pro）全量运行，配置读取不依赖激活码。
 */
import { getTelemetrySecret } from "./ee-bridge/index.ts";

export const REPORT_SETTING_ENABLED = "analytics_report_enabled";
export const REPORT_SETTING_LAST_WEEK = "analytics_last_report_week";

/**
 * 匿名周报开关：默认开启（每周自动上报匿名聚合统计到接收端点，帮助作者改进产品）。
 * 优先级：DB → 环境变量 → 默认 true。
 * 关闭方式：环境变量 NAVELIX_ANALYTICS_REPORT=off/0/false。
 * 界面不提供任何开关入口（保持用户无感），由部署方通过环境变量控制。
 */
export function isAnalyticsReportEnabled(): boolean {
  const raw = getSystemSetting(REPORT_SETTING_ENABLED);
  if (raw === "1" || raw === "true" || raw === "on") return true;
  if (raw === "0" || raw === "false" || raw === "off") return false;
  const env = process.env.NAVELIX_ANALYTICS_REPORT;
  if (env === "1" || env === "true" || env === "on") return true;
  if (env === "0" || env === "false" || env === "off") return false;
  return true; // 默认开启：匿名聚合上报，不含任何个人数据
}

export function setAnalyticsReportEnabled(enabled: boolean): void {
  setSystemSetting(REPORT_SETTING_ENABLED, enabled ? "1" : "0");
}

/** 上报端点：环境变量 > ee 字节码 > 空 */
export function getAnalyticsReportEndpoint(): string {
  const env = process.env.NAVELIX_ANALYTICS_ENDPOINT?.trim();
  if (env) return env;
  return getTelemetrySecret()?.endpoint || "";
}

/** 上报鉴权 TOKEN：环境变量 > ee 字节码 > 空 */
export function getAnalyticsReportToken(): string {
  const env = (process.env.NAVELIX_ANALYTICS_TOKEN || "").trim();
  if (env) return env;
  return getTelemetrySecret()?.token || "";
}

/** 上报超时（毫秒）：环境变量 NAVELIX_ANALYTICS_TIMEOUT_MS 可覆盖，默认 30 秒（接收端常在海外，跨国链路需放宽） */
export function getAnalyticsReportTimeoutMs(): number {
  const raw = (process.env.NAVELIX_ANALYTICS_TIMEOUT_MS || "").trim();
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed >= 1000) return parsed;
  return 30_000;
}

/** 上一次成功上报的「本周一」日期（YYYY-MM-DD），无则空串 */
export function getLastReportWeek(): string {
  return getSystemSetting(REPORT_SETTING_LAST_WEEK);
}

function setLastReportWeek(weekStart: string): void {
  setSystemSetting(REPORT_SETTING_LAST_WEEK, weekStart);
}

/** 取本周一的本地日期（YYYY-MM-DD） */
export function currentWeekStart(): string {
  const d = new Date();
  // getDay(): 0=Sun..6=Sat → 本周一 = 今天 - ((day + 6) % 7)
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 解析 YYYY-MM-DD 为本地当日 0 点时间戳 */
function dayStartMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** 计算「上周（本周一之前的完整 7 天）」的聚合统计 */
export function buildWeeklyAggregate(): {
  weekStart: string;
  events: Record<string, number>;
  moduleTotals: Record<string, number>;
  valueMoments: number;
  userCount: number;
  runtime: { node: string; docker: boolean };
  // ── 增强维度（v2）──
  content: {
    linkCount: number;
    categoryCount: number;
    projectCount: number;
    openTodoCount: number;
  };
  activity: {
    activeUsers: number;
    activeDays: number;
  };
  profile: {
    theme: string;
    wallpaperMode: string;
    linkOpenTarget: string;
    maxWidth: string;
  };
  ai: {
    configured: boolean;
    model: string;
  };
  deploy: {
    mode: string;
    timezone: string;
  };
} {
  const weekStart = currentWeekStart();
  const start = dayStartMs(weekStart) - 7 * 86_400_000;
  const end = dayStartMs(weekStart);

  // 上周全部事件计数（按 event 分组）
  const rows = db
    .prepare(
      "SELECT event, COUNT(*) AS c FROM analytics_events WHERE ts >= ? AND ts < ? GROUP BY event",
    )
    .all(start, end) as Array<{ event: string; c: number }>;

  const events: Record<string, number> = {};
  const moduleTotals: Record<string, number> = {};
  let valueMoments = 0;

  for (const row of rows) {
    const event = row.event;
    if (!EVENT_MODULES[event]) continue; // 未登记事件绝不外发
    const count = Number(row.c);
    events[event] = count;
    const mod = EVENT_MODULES[event];
    moduleTotals[mod] = (moduleTotals[mod] || 0) + count;
    if (VALUE_MOMENT_EVENTS.has(event)) valueMoments += count;
  }

  // ── 内容规模：纯数量计数（零隐私风险）──
  const linkCount = (
    db.prepare("SELECT COUNT(*) AS c FROM user_links").get() as { c: number }
  ).c;
  const categoryCount = (
    db.prepare("SELECT COUNT(*) AS c FROM user_categories").get() as { c: number }
  ).c;
  const projectCount = (
    db.prepare("SELECT COUNT(*) AS c FROM projects").get() as { c: number }
  ).c;
  const openTodoCount = (
    db.prepare("SELECT COUNT(*) AS c FROM user_todos WHERE done = 0").get() as { c: number }
  ).c;

  // ── 活跃度：本周（非上周）去重活跃用户 + 有活动天数 ──
  const activeRows = db
    .prepare(
      `SELECT DISTINCT date(ts / 1000, 'unixepoch', 'localtime') AS day, user_id
       FROM analytics_events
       WHERE event IN (${Array.from(VALUE_MOMENT_EVENTS).map((e) => `'${e}'`).join(",")})
         AND ts >= ?`,
    )
    .all(dayStartMs(weekStart)) as Array<{ day: string; user_id: string }>;
  const activeUsers = new Set(activeRows.map((r) => r.user_id)).size;
  const activeDays = new Set(activeRows.map((r) => r.day)).size;

  // ── 外观画像：枚举值（非敏感）──
  const cfg = db
    .prepare(
      "SELECT theme, wallpaper_mode, link_open_target, max_width FROM user_configs WHERE user_id = (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1)",
    )
    .get() as
    | { theme: string; wallpaper_mode: string; link_open_target: string; max_width: string }
    | undefined;

  // ── AI 渗透率：是否配置 Key + 模型枚举 ──
  const aiRow = db
    .prepare(
      "SELECT ai_model FROM user_configs WHERE user_id = (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1)",
    )
    .get() as { ai_model: string } | undefined;
  const aiKeyRow = db
    .prepare(
      "SELECT ai_api_key FROM user_configs WHERE user_id = (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1)",
    )
    .get() as { ai_api_key: string } | undefined;

  const userCount = (
    db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }
  ).c;

  const nodeMajor = process.versions.node.split(".")[0] || "";
  const dockerRuntime = isDockerRuntime();
  return {
    weekStart,
    events,
    moduleTotals,
    valueMoments,
    userCount: Number(userCount),
    runtime: {
      node: nodeMajor,
      docker: dockerRuntime,
    },
    // ── 增强维度（v2）──
    content: {
      linkCount: Number(linkCount),
      categoryCount: Number(categoryCount),
      projectCount: Number(projectCount),
      openTodoCount: Number(openTodoCount),
    },
    activity: {
      activeUsers,
      activeDays,
    },
    profile: {
      theme: cfg?.theme || "system",
      wallpaperMode: cfg?.wallpaper_mode || "none",
      linkOpenTarget: cfg?.link_open_target || "_blank",
      maxWidth: cfg?.max_width || "1200px",
    },
    ai: {
      configured: Boolean(aiKeyRow?.ai_api_key),
      model: aiRow?.ai_model || "none",
    },
    deploy: {
      mode: dockerRuntime ? "docker" : "source",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
    },
  };
}

/** 构造上报载荷（不含敏感字段，仅聚合计数/布尔/枚举） */
export async function buildReportPayload(): Promise<{
  v: number;
  instanceId: string;
  version: string;
  weekStart: string;
  events: Record<string, number>;
  moduleTotals: Record<string, number>;
  valueMoments: number;
  userCount: number;
  runtime: { node: string; docker: boolean };
  content: {
    linkCount: number;
    categoryCount: number;
    projectCount: number;
    openTodoCount: number;
  };
  activity: { activeUsers: number; activeDays: number };
  profile: {
    theme: string;
    wallpaperMode: string;
    linkOpenTarget: string;
    maxWidth: string;
  };
  ai: { configured: boolean; model: string };
  deploy: { mode: string; timezone: string };
}> {
  const agg = buildWeeklyAggregate();
  return {
    v: 2,
    instanceId: getAnalyticsInstanceId(),
    version: getBuildInfo().version,
    weekStart: agg.weekStart,
    events: agg.events,
    moduleTotals: agg.moduleTotals,
    valueMoments: agg.valueMoments,
    userCount: agg.userCount,
    runtime: agg.runtime,
    content: agg.content,
    activity: agg.activity,
    profile: agg.profile,
    ai: agg.ai,
    deploy: agg.deploy,
  };
}

/**
 * 尝试执行一次周报（由 daemon 每周调用）。
 * 返回 "sent" | "skipped" | "disabled" | "empty" | "failed"。
 */
export async function maybeRunWeeklyReport(): Promise<
  "sent" | "skipped" | "disabled" | "empty" | "failed"
> {
  if (!isAnalyticsReportEnabled()) return "disabled";
  if (!isAnalyticsEnabled()) {
    // 本地统计未开启时无数据可上报；仍允许纯实例心跳（无 events 时下方判 empty）
  }

  const weekStart = currentWeekStart();
  const last = getLastReportWeek();
  if (last === weekStart) return "skipped"; // 本周已上报过

  const payload = await buildReportPayload();
  if (Object.keys(payload.events).length === 0 && payload.userCount === 0) {
    // 无任何数据：不发送空包（避免无意义流量）
    return "empty";
  }

  const endpoint = getAnalyticsReportEndpoint();
  if (!endpoint) return "disabled";

  try {
    const token = getAnalyticsReportToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["X-Navelix-Token"] = token; // 接收端配置了 TOKEN 时必带，否则 401

    const timeoutMs = getAnalyticsReportTimeoutMs();
    const res = await safeFetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      timeoutMs,
      allowPrivateIPs: false,
    });
    if (!res.ok) {
      console.warn(`[Analytics Report] 上报失败 HTTP ${res.status}`);
      return "failed";
    }
    setLastReportWeek(weekStart);
    return "sent";
  } catch (err) {
    console.warn("[Analytics Report] 上报异常:", err instanceof Error ? err.message : err);
    return "failed";
  }
}
