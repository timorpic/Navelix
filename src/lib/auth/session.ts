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
} from "../db.ts";
import { getClientId } from "./client-id.ts";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

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
