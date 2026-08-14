import {
  createHash,
  randomBytes,
} from "node:crypto";
import { cookies, headers } from "next/headers.js";
import {
  db,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  type PublicUser,
  type UserRow,
} from "./db.ts";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export { hashPassword, verifyPassword } from "./password.ts";
export { checkCSRF } from "./csrf.ts";

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    email: row.email || "",
    bio: row.bio || "",
    role: row.role === "admin" ? "admin" : "user",
    avatar: row.avatar || "",
  };
}

export async function createSession(userId: string, req?: Request): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  let userAgent = "";
  let ipAddress = "";

  if (req) {
    userAgent = req.headers.get("user-agent") || "";
    ipAddress = getClientId(req);
  }

  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, user_agent, ip_address, last_active_at, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(hashToken(token), userId, userAgent, ipAddress, now, now + SESSION_TTL_MS, now);
  return token;
}

export async function destroySession(token: string): Promise<void> {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export async function getSessionUser(req?: Request): Promise<PublicUser | null> {
  const now = Date.now();

  // 1. 优先尝试从 Authorization: Bearer <nvx_live_...> 请求头中鉴权 (用于 API Token 外部/脚本/快捷指令调用)
  let authHeader = req ? req.headers.get("authorization") : null;
  if (!authHeader) {
    try {
      const reqHeaders = await headers();
      authHeader = reqHeaders.get("authorization");
    } catch {
      // ignore outside request scope
    }
  }

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const rawToken = authHeader.slice(7).trim();
    if (rawToken.startsWith("nvx_live_")) {
      const tokenHash = hashToken(rawToken);
      const tokenRow = db
        .prepare(
          `SELECT u.id, u.username, u.password_hash, u.display_name, u.email, u.bio, u.role, u.avatar, u.created_at, t.id as token_id
           FROM api_tokens t
           JOIN users u ON u.id = t.user_id
           WHERE t.token_hash = ?`,
        )
        .get(tokenHash) as (UserRow & { token_id: string }) | undefined;

      if (tokenRow) {
        db.prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?").run(
          now,
          tokenRow.token_id,
        );
        return toPublicUser(tokenRow);
      }
    }
  }

  // 2. 尝试从 Cookie 中鉴权 (用于 Web 浏览器内部登录会话)
  let token: string | undefined;
  try {
    const cookieStore = await cookies();
    token = cookieStore.get(SESSION_COOKIE)?.value;
  } catch {
    // ignore outside request scope
  }
  if (!token) return null;

  const tokenHash = hashToken(token);

  const row = db
    .prepare(
      `SELECT u.id, u.username, u.password_hash, u.display_name, u.email, u.bio, u.role, u.avatar, u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(tokenHash, now) as UserRow | undefined;

  if (!row) return null;

  db.prepare("UPDATE sessions SET last_active_at = ? WHERE token_hash = ?").run(now, tokenHash);
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
  return toPublicUser(row);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    // SameSite=Lax 提供基本的 CSRF 防护：跨站 POST 请求不会携带 Cookie。
    sameSite: "lax" as const,
    // 局域网 http 部署默认不启用 Secure（否则浏览器不会回传 Cookie，导致反复登录）；
    // 使用 HTTPS 时设置环境变量 NAVELIX_COOKIE_SECURE=true
    secure: process.env.NAVELIX_COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

/** 清除会话 Cookie（与 sessionCookieOptions 保持 sameSite/secure/domain 一致） */
export function clearSessionCookieOptions() {
  return {
    ...sessionCookieOptions(),
    maxAge: 0,
  };
}

// ── 登录速率限制 ──────────────────────────────────────
export function getClientId(req: Request): string {
  const trustProxy =
    process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1";
  if (trustProxy) {
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  }
  return "direct-client";
}

// 内存级限流（Node.js 运行时跨请求持久），5 次失败锁定 15 分钟
const LOGIN_THRESHOLD = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; firstFailure: number }>();

export interface LoginRateLimitStatus {
  allowed: boolean;
  /** 剩余允许尝试次数（未锁定时使用） */
  remaining: number;
  /** 剩余锁定毫秒数（被锁定时使用，未锁定为 0） */
  lockRemainingMs: number;
}

export function checkLoginRateLimit(clientId: string): LoginRateLimitStatus {
  const now = Date.now();
  const entry = loginAttempts.get(clientId);
  if (!entry) {
    return { allowed: true, remaining: LOGIN_THRESHOLD, lockRemainingMs: 0 };
  }
  if (now - entry.firstFailure > LOGIN_WINDOW_MS) {
    loginAttempts.delete(clientId);
    return { allowed: true, remaining: LOGIN_THRESHOLD, lockRemainingMs: 0 };
  }
  const remaining = Math.max(0, LOGIN_THRESHOLD - entry.count);
  // 实际剩余锁定时间：从首次失败时刻开始计算，窗口结束前均为锁定状态
  const lockRemainingMs = Math.max(
    0,
    entry.firstFailure + LOGIN_WINDOW_MS - now,
  );
  return { allowed: entry.count < LOGIN_THRESHOLD, remaining, lockRemainingMs };
}

export function recordLoginFailure(clientId: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(clientId);
  if (!entry || now - entry.firstFailure > LOGIN_WINDOW_MS) {
    loginAttempts.set(clientId, { count: 1, firstFailure: now });
  } else {
    entry.count++;
  }
}

export function resetLoginRateLimit(clientId: string): void {
  loginAttempts.delete(clientId);
}
