import { randomUUID } from "node:crypto";
import { db } from "./db.ts";
import { getSystemSetting, setSystemSetting } from "./system-settings.ts";

/**
 * 可选遥测（Opt-in Analytics）核心库。
 *
 * 规范：wiki/Analytics-使用统计与埋点规范.md
 * 设计原则：
 *   - 默认开启（env NAVELIX_ANALYTICS=on|off，DB 开关可覆盖，均默认 on）
 *   - 数据仅存本机 SQLite analytics_events 表，永不外发
 *   - 事件仅记录事件名 / 用户 ID / 实例 ID / 聚合 meta / 时间戳，禁止敏感内容
 *   - track() 失败静默，不阻塞主请求
 */

export const ANALYTICS_SETTING_ENABLED = "analytics_enabled";
export const ANALYTICS_SETTING_INSTANCE_ID = "analytics_instance_id";

/** 价值时刻事件集合（wiki §6.2）——激活/留存/趋势统计的事件口径 */
export const VALUE_MOMENT_EVENTS = new Set([
  "nav.link_click",
  "ai.chat_sent",
  "calendar.view",
  "project.gantt_view",
  "todo.complete",
  "nav.link_add",
  "nav.link_edit",
  "backup.create",
]);

/** 激活事件集合（wiki §6.1） */
export const ACTIVATION_EVENTS = new Set([
  "nav.bookmark_import",
  "nav.link_add",
  "ai.chat_sent",
]);

/** 事件 → 模块中文名（与 wiki §4 清单一致，用于模块分布统计） */
export const EVENT_MODULES: Record<string, string> = {
  "nav.link_click": "导航",
  "nav.search": "导航",
  "nav.bookmark_import": "导航",
  "nav.link_add": "导航",
  "nav.link_edit": "导航",
  "nav.link_delete": "导航",
  "ai.chat_sent": "AI",
  "ai.project_breakdown": "AI",
  "ai.daily_schedule": "AI",
  "project.create": "项目",
  "project.update": "项目",
  "project.gantt_view": "项目",
  "todo.create": "日历",
  "todo.complete": "日历",
  "todo.rollover": "日历",
  "calendar.view": "日历",
  "backup.create": "备份",
  "backup.restore": "备份",
  "auth.register": "账户",
  "auth.login": "账户",
  "auth.logout": "账户",
  "monitor.quota_view": "监控",
  "team.member_add": "协作",
  "share.create": "协作",
};

export const ANALYTICS_MODULE_ORDER = [
  "导航",
  "AI",
  "项目",
  "日历",
  "备份",
  "账户",
  "监控",
  "协作",
];

/** 事件名白名单（未登记事件禁止埋点，防漂移） */
export const KNOWN_EVENTS = new Set(Object.keys(EVENT_MODULES));

/* ──────────────────────────────────────────────
 * 开关与实例 ID
 * ────────────────────────────────────────────── */

/**
 * 本地使用统计是否启用：默认开启（数据仅存本机 SQLite，无隐私风险，开箱即有报表）。
 * 优先级：DB 开关（后台停用写入 "0"）→ 环境变量 → 默认 true。
 * 关闭方式：环境变量 NAVELIX_ANALYTICS=off/0/false，或后台「访问统计」页停用。
 */
export function isAnalyticsEnabled(): boolean {
  const raw = getSystemSetting(ANALYTICS_SETTING_ENABLED);
  if (raw === "1" || raw === "true" || raw === "on") return true;
  if (raw === "0" || raw === "false" || raw === "off") return false;
  const env = process.env.NAVELIX_ANALYTICS;
  if (env === "1" || env === "true" || env === "on") return true;
  if (env === "0" || env === "false" || env === "off") return false;
  return true; // 默认开启：本地统计仅存本机，无外发
}

export function setAnalyticsEnabled(enabled: boolean): void {
  setSystemSetting(ANALYTICS_SETTING_ENABLED, enabled ? "1" : "0");
}

/** 实例 ID：首次启用时生成 UUID 并持久化（用于 M1 匿名汇总的去重，当前仅存本地） */
export function getAnalyticsInstanceId(): string {
  const existing = getSystemSetting(ANALYTICS_SETTING_INSTANCE_ID);
  if (existing) return existing;
  const id = randomUUID();
  setSystemSetting(ANALYTICS_SETTING_INSTANCE_ID, id);
  return id;
}

/* ──────────────────────────────────────────────
 * 事件采集
 * ────────────────────────────────────────────── */

export interface TrackOptions {
  /** 用户库内 ID；无用户上下文（如 daemon）传 'system'，登录前动作传 'anonymous' */
  userId?: string;
  /** 聚合元数据（数量/时长/维度等），禁止敏感内容，深度 ≤2 层 */
  meta?: Record<string, unknown>;
}

/**
 * 记录一条事件。关闭时零开销返回；写入失败静默（不阻塞主请求）。
 * 未登记事件名直接忽略（防漂移，规范 §9）。
 */
export function track(event: string, opts: TrackOptions = {}): void {
  if (!isAnalyticsEnabled()) return;
  if (!KNOWN_EVENTS.has(event)) return;
  try {
    db.prepare(`
      INSERT INTO analytics_events (event, user_id, instance_id, meta, ts)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      event,
      opts.userId || "anonymous",
      getAnalyticsInstanceId(),
      JSON.stringify(opts.meta ?? {}),
      Date.now(),
    );
  } catch {
    // 失败静默：遥测绝不能影响主功能
  }
}

/** 清空全部事件（管理员操作，需二次确认由 UI 侧保证） */
export function clearAnalyticsEvents(): void {
  try {
    db.exec("DELETE FROM analytics_events");
  } catch {
    // ignore
  }
}

/* ──────────────────────────────────────────────
 * 汇总统计（管理后台 /api/admin/analytics/summary）
 * ────────────────────────────────────────────── */

interface Row {
  [key: string]: unknown;
}

function firstEventTs(): number | null {
  const row = db
    .prepare("SELECT MIN(ts) AS ts FROM analytics_events")
    .get() as Row | undefined;
  const ts = row?.ts;
  return typeof ts === "number" ? ts : null;
}

function countEvents(where: string, params: (string | number)[] = []): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM analytics_events WHERE ${where}`)
    .get(...params) as Row | undefined;
  return Number(row?.c ?? 0);
}

/**
 * 生成管理后台「使用统计」汇总数据。
 * 注：本月激活率口径 = 本月新注册用户（auth.register）中已达成激活的比例；
 * 注册样本 < 3 时返回 null（样本不足，避免误导）。
 */
export function getAnalyticsSummary() {
  const enabled = isAnalyticsEnabled();
  const now = Date.now();
  const dayMs = 86_400_000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayStart = startOfToday.getTime();

  const valueSet = Array.from(VALUE_MOMENT_EVENTS)
    .map((e) => `'${e}'`)
    .join(",");

  // ── 概览卡 ──
  const todayValueMoments = countEvents(
    `event IN (${valueSet}) AND ts >= ?`,
    [todayStart],
  );

  const wau = (() => {
    const rows = db
      .prepare(
        `SELECT COUNT(DISTINCT user_id) AS c FROM analytics_events
         WHERE event IN (${valueSet}) AND ts >= ?`,
      )
      .all(now - 7 * dayMs) as Row[];
    return Number(rows[0]?.c ?? 0);
  })();

  // ── 本月激活率 ──
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const ms = monthStart.getTime();

  const registeredUsers = (
    db
      .prepare(
        `SELECT DISTINCT user_id FROM analytics_events
         WHERE event = 'auth.register' AND ts >= ?`,
      )
      .all(ms) as Row[]
  ).map((r) => String(r.user_id));

  let activationRate: number | null = null;
  if (registeredUsers.length >= 3) {
    let activated = 0;
    for (const uid of registeredUsers) {
      const u = db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM analytics_events WHERE event = 'nav.bookmark_import' AND user_id = ?) AS imported,
             (SELECT COUNT(*) FROM analytics_events WHERE event = 'nav.link_add' AND user_id = ?) AS added,
             (SELECT COUNT(*) FROM analytics_events WHERE event = 'ai.chat_sent' AND user_id = ?) AS aiChat
          `,
        )
        .get(uid, uid, uid) as Row;
      const imported = Number(u.imported ?? 0);
      const added = Number(u.added ?? 0);
      const aiChat = Number(u.aiChat ?? 0);
      if (imported > 0 || added >= 3 || aiChat > 0) activated++;
    }
    activationRate = Math.round((activated / registeredUsers.length) * 100);
  }

  const totalEvents = countEvents("1 = 1");

  // ── 近 7 日价值时刻趋势 ──
  const trend7d: Array<{ date: string; count: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * dayMs);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const start = dayStart.getTime();
    const end = start + dayMs;
    const c = countEvents(`event IN (${valueSet}) AND ts >= ? AND ts < ?`, [
      start,
      end,
    ]);
    trend7d.push({ date: key, count: c });
  }

  // ── 功能使用 Top 榜 ──
  const topEvents = (
    db
      .prepare(
        `SELECT event, COUNT(*) AS count FROM analytics_events
         GROUP BY event ORDER BY count DESC LIMIT 10`,
      )
      .all() as Row[]
  ).map((r) => ({
    event: String(r.event),
    count: Number(r.count),
    label: String(r.event),
    module: EVENT_MODULES[String(r.event)] || "其他",
  }));

  // ── 模块分布 ──
  const moduleCounts = new Map<string, number>();
  for (const row of db
    .prepare(`SELECT event, COUNT(*) AS c FROM analytics_events GROUP BY event`)
    .all() as Row[]) {
    const mod = EVENT_MODULES[String(row.event)] || "其他";
    moduleCounts.set(mod, (moduleCounts.get(mod) ?? 0) + Number(row.c ?? 0));
  }
  const moduleBreakdown = ANALYTICS_MODULE_ORDER.filter((m) =>
    moduleCounts.has(m),
  ).map((m) => ({
    module: m,
    count: moduleCounts.get(m) ?? 0,
    percent:
      totalEvents > 0
        ? Math.round(((moduleCounts.get(m) ?? 0) / totalEvents) * 100)
        : 0,
  }));

  // ── 留存简表（最近 5 个注册日群组） ──
  const registerDays = (
    db
      .prepare(
        `SELECT DISTINCT date(ts / 1000, 'unixepoch', 'localtime') AS day
         FROM analytics_events WHERE event = 'auth.register'
         ORDER BY day DESC LIMIT 5`,
      )
      .all() as Row[]
  ).map((r) => String(r.day));

  const retention = registerDays.map((day) => {
    const cohortUsers = (
      db
        .prepare(
          `SELECT DISTINCT user_id FROM analytics_events
           WHERE event = 'auth.register' AND date(ts / 1000, 'unixepoch', 'localtime') = ?`,
        )
        .all(day) as Row[]
    ).map((r) => String(r.user_id));
    const sampleSize = cohortUsers.length;

    const isActiveOn = (dayOffset: number) => {
      const base = new Date(`${day}T00:00:00`);
      const targetStart = base.getTime() + dayOffset * dayMs;
      const targetEnd = targetStart + dayMs;
      const rows = db
        .prepare(
          `SELECT DISTINCT user_id FROM analytics_events
           WHERE event IN (${valueSet}) AND ts >= ? AND ts < ?`,
        )
        .all(targetStart, targetEnd) as Row[];
      const activeSet = new Set(rows.map((r) => String(r.user_id)));
      return cohortUsers.filter((u) => activeSet.has(u)).length;
    };

    const d1Count = isActiveOn(1);
    const d7Count = isActiveOn(7);
    return {
      cohortDate: day,
      sampleSize,
      d1: sampleSize >= 3 ? Math.round((d1Count / sampleSize) * 100) : null,
      d7: sampleSize >= 3 ? Math.round((d7Count / sampleSize) * 100) : null,
    };
  });

  return {
    enabled,
    collectedSince: firstEventTs(),
    stats: {
      todayValueMoments,
      wau,
      activationRate,
      totalEvents,
    },
    trend7d,
    topEvents,
    moduleBreakdown,
    retention,
  };
}
