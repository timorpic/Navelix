import { randomBytes } from "node:crypto";
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
}): void {
  try {
    const id = `aud-${Date.now()}-${randomBytes(4).toString("hex")}`;
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target, ip, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.userId,
      params.action,
      params.target || "",
      params.ip || "",
      params.details || "",
      Date.now(),
    );
  } catch (err) {
    console.warn("[Navelix Audit] Failed to record audit log:", err);
  }
}

/**
 * 查询最近的安全审计日志
 */
export function getRecentAuditLogs(userId?: string, limit = 50): AuditLogEntry[] {
  try {
    if (userId) {
      return (db
        .prepare(`
          SELECT id, user_id as userId, action, target, ip, details, created_at as createdAt
          FROM audit_logs
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        `)
        .all(userId, limit) as unknown) as AuditLogEntry[];
    }
    return (db
      .prepare(`
        SELECT id, user_id as userId, action, target, ip, details, created_at as createdAt
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(limit) as unknown) as AuditLogEntry[];
  } catch {
    return [];
  }
}
