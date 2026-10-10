import { db, SESSION_COOKIE } from "../db.ts";
import { cookies } from "next/headers.js";
import { hashToken } from "./api-tokens.ts";

/**
 * 活跃会话设备的列举与撤销（下沉自 `api/auth/sessions/route.ts`）。
 *
 * 下沉动机有二：
 * 1. 该路由自己又定义了一份 `hashToken`（与 session.ts、api-tokens.ts 同算法），
 *    摘要算法应只有一处定义；
 * 2. `sessions` 表的读写此前只在这里出现，与 `auth/session.ts` 的会话 CRUD
 *    分处两地。
 */

export interface SessionItem {
  tokenHash: string;
  userAgent: string;
  ipAddress: string;
  lastActiveAt: number;
  createdAt: number;
  isCurrent: boolean;
}

interface SessionRow {
  token_hash: string;
  user_agent: string;
  ip_address: string;
  last_active_at: number;
  created_at: number;
}

/** 读取当前会话 Cookie 的摘要（用于标记「本机」）。 */
export async function currentSessionHash(): Promise<string> {
  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE)?.value || "";
  return currentToken ? hashToken(currentToken) : "";
}

/** 列出该用户未过期的活跃会话，最近活跃在前。 */
export function listSessions(userId: string, currentHash: string): SessionItem[] {
  const rows = db
    .prepare(
      `SELECT token_hash, user_agent, ip_address, last_active_at, created_at
       FROM sessions
       WHERE user_id = ? AND expires_at > ?
       ORDER BY last_active_at DESC`,
    )
    .all(userId, Date.now()) as unknown as SessionRow[];

  return rows.map((r) => ({
    tokenHash: r.token_hash,
    userAgent: r.user_agent || "未知设备/浏览器",
    ipAddress: r.ip_address || "未知 IP",
    // 老库可能没有 last_active_at，回落到创建时间
    lastActiveAt: r.last_active_at || r.created_at,
    createdAt: r.created_at,
    isCurrent: r.token_hash === currentHash,
  }));
}

/** 注销该用户除当前会话外的全部设备。 */
export function revokeOtherSessions(userId: string, currentHash: string): void {
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").run(
    userId,
    currentHash,
  );
}

/**
 * 强退指定会话。
 *
 * 带 `user_id` 条件，因此无法踢掉他人的会话 —— 即使拿到了对方的 token 摘要。
 */
export function revokeSession(userId: string, tokenHash: string): void {
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash = ?").run(
    userId,
    tokenHash,
  );
}
