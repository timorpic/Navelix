import { randomBytes } from "node:crypto";
import { createLogEvent } from "./logging/events.ts";
import { categoryForEvent } from "./logging/catalog.ts";
import { safeIdentifier, safeText, sanitizeChanges } from "./logging/redact.ts";
import type { LogEvent } from "./logging/types.ts";
import { db } from "./db.ts";

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  target?: string;
  ip?: string;
  details?: string;
  createdAt: number;
}

/**
 * 记录安全审计日志 (Security Audit Log)
 * 覆盖：管理员登录、密码变更、API Key 更新、数据库备份/还原、敏感配置修改
 */
export function recordAuditLog(params: {
  userId: string;
  action: string;
  target?: string;
  ip?: string;
  details?: string;
  outcome?: LogEvent["outcome"];
  operationId?: string;
}): void {
  let details = safeText(params.details ?? "", 4000);
  // 解析失败时保留原文（包成 { text }），不再静默退化成 []：
  // 旧版把无法解析的 details 一律记为「无变更」，审计证据被悄悄丢掉。
  let changeDetails: unknown = [];
  try {
    const parsed: unknown = JSON.parse(params.details ?? "");
    if (Array.isArray(parsed)) {
      details = JSON.stringify(sanitizeChanges(parsed));
      changeDetails = JSON.parse(details);
    } else {
      changeDetails = { text: details };
    }
  } catch {
    // 历史明文 details：原文保留
    changeDetails = params.details ? { text: details } : [];
  }
  const event = createLogEvent({ category: params.target === "user_notification_settings" ? "notification" : categoryForEvent(params.action), event: params.action, kind: "audit", actorId: params.userId, actorType: params.userId === "system" ? "system" : params.userId ? "user" : "anonymous", level: params.outcome === "failed" ? "warn" : "info",
    subjectId: params.target, outcome: params.outcome ?? "succeeded", operationId: params.operationId, details: { changes: changeDetails } });
  const id = `aud-${Date.now()}-${randomBytes(4).toString("hex")}`;
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target, ip, details, created_at, category, event_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.userId,
      params.action,
      safeIdentifier(params.target),
      "",
      details,
      event.timestamp,
      event.category,
      JSON.stringify({ ...event, id }),
    );
}

/**
 * 审计日志列表项：附带操作者身份（用户名/显示名）。
 * `audit_logs.user_id` 无外键级联——被删账号的历史审计仍保留（合规证据），
 * 因此 LEFT JOIN 用户在行缺失时回退为「已删除账号」。
 */
export interface AuditLogListEntry extends AuditLogEntry {
  username: string;
  displayName: string;
}

export interface ListAuditLogsOptions {
  limit?: number;
  offset?: number;
  /** 按动作过滤（如 "config.updated"） */
  action?: string;
  /** 关键字：匹配用户名 / 显示名 / 动作 / 目标 / 详情 */
  q?: string;
}

export interface AuditLogListResult {
  logs: AuditLogListEntry[];
  total: number;
}

/**
 * 分页查询审计日志（后台「审计日志」页专用），带身份 JOIN 与过滤。
 *
 * `q` 为宽松关键字：同时匹配用户名、显示名、动作、目标与详情文本，
 * 让管理员能快速定位「谁 / 改了什么」。
 */
export function listAuditLogs(options: ListAuditLogsOptions = {}): AuditLogListResult {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);

  const where: string[] = [];
  const params: (string | number)[] = [];

  if (options.action) {
    where.push("a.action = ?");
    params.push(options.action);
  }
  if (options.q) {
    const q = options.q.trim();
    if (q) {
      where.push(
        "(u.username LIKE ? OR u.display_name LIKE ? OR a.action LIKE ? OR a.target LIKE ? OR a.details LIKE ?)",
      );
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = db
      .prepare(`SELECT COUNT(*) AS c FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ${whereSql}`)
      .get(...params) as { c: number };

    const rows = db
      .prepare(
        `SELECT a.id, a.user_id AS userId, a.action, a.target, a.ip, a.details, a.created_at AS createdAt,
                COALESCE(u.username, '') AS username, COALESCE(u.display_name, '') AS displayName
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.user_id
         ${whereSql}
         ORDER BY a.created_at DESC, a.rowid DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as unknown as AuditLogListEntry[];

    return { logs: rows, total: totalRow.c };
}
