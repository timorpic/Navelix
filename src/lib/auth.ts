import {
  createHash,
  randomBytes,
} from "node:crypto";
import { cookies } from "next/headers";
import {
  db,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  type PublicUser,
  type UserRow,
} from "./db";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export { hashPassword, verifyPassword } from "./password";

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    role: row.role === "admin" ? "admin" : "user",
    avatar: row.avatar || "",
  };
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  db.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  ).run(hashToken(token), userId, now + SESSION_TTL_MS, now);
  return token;
}

export async function destroySession(token: string): Promise<void> {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export async function getSessionUser(): Promise<PublicUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT u.id, u.username, u.password_hash, u.display_name, u.role, u.avatar, u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(hashToken(token), Date.now()) as UserRow | undefined;

  if (!row) return null;
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
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

/**
 * CSRF 纵深防御：检查请求的 Origin/Referer 是否为同源。
 * 即使 SameSite=Lax 已拦截跨站 POST，此函数提供额外一层保护。
 * 同源检查通过返回 true；无 Origin/Referer（如 CLI 工具）默认放行。
 */
export function checkCSRF(req: Request): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  if (!origin && !referer) return true;
  const hostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const host = hostHeader.split(":")[0];
  if (!host) return true;

  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      if (originHost === host || originHost === "localhost" || originHost === "127.0.0.1") return true;
    } catch {
      return false;
    }
  }
  if (referer) {
    try {
      const refererHost = new URL(referer).hostname;
      if (refererHost === host || refererHost === "localhost" || refererHost === "127.0.0.1") return true;
    } catch {
      return false;
    }
  }
  return true;
}

// ── 登录速率限制 ──────────────────────────────────────
// 内存级限流（Node.js 运行时跨请求持久），5 次失败锁定 15 分钟
const LOGIN_THRESHOLD = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; firstFailure: number }>();

export function checkLoginRateLimit(clientId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = loginAttempts.get(clientId);
  if (!entry) {
    return { allowed: true, remaining: LOGIN_THRESHOLD };
  }
  if (now - entry.firstFailure > LOGIN_WINDOW_MS) {
    loginAttempts.delete(clientId);
    return { allowed: true, remaining: LOGIN_THRESHOLD };
  }
  const remaining = Math.max(0, LOGIN_THRESHOLD - entry.count);
  return { allowed: entry.count < LOGIN_THRESHOLD, remaining };
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
