import { recordAuditLog } from "@/lib/audit";
import { withRequestLogging } from "@/lib/logging/request";
import { getLocale } from "next-intl/server";
import { normalizeLocale } from "@/lib/i18n";
import { saveUserConfigs } from "@/lib/user-data";
import { localizedJson } from "@/lib/localized-json";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db, seedUserData, SESSION_COOKIE } from "@/lib/db";
import { createSession, hashPassword, sessionCookieOptions, toPublicUser } from "@/lib/auth";
import { canRegister } from "@/lib/registration";
import { getClientId } from "@/lib/auth/client-id";
import { simpleRateLimit } from "@/lib/rate-limit";
import { readLimitedJson, RequestBodyError } from "@/lib/request-body";

// GET /api/auth/register - 公开读取注册开关（登录页/注册页为未登录页面，无法走需 session 的 /api/user/data）。
// allowRegistration 是纯布尔策略，不含用户列表/用户名等敏感信息，且该状态本可经 POST 试探得出，故无需鉴权。
async function GETHandler() {
  return localizedJson({ allowRegistration: canRegister() });
}

async function POSTHandler(req: Request) {
  if (!canRegister()) return localizedJson({ error: "系统当前已关闭新用户注册，请联系管理员" }, { status: 403 });
  const limit = simpleRateLimit(`register:${getClientId(req)}`, 5, 15 * 60_000);
  if (!limit.allowed) return localizedJson({ error: "注册尝试过于频繁，请稍后再试" }, {
    status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
  });
  const language = normalizeLocale(await getLocale());
  let parsed: unknown;
  try { parsed = await readLimitedJson(req, 4096); }
  catch (error) {
    if (error instanceof RequestBodyError) return localizedJson({ error: error.message }, { status: error.status });
    throw error;
  }
  const body = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  if (!body || typeof body.username !== "string" || typeof body.password !== "string" ||
      (body.displayName !== undefined && typeof body.displayName !== "string")) {
    return localizedJson({ error: "无效的请求数据" }, { status: 400 });
  }
  const username = String(body?.username ?? "")
    .trim()
    .toLowerCase();
  const password = String(body?.password ?? "");
  const displayName = String(body?.displayName ?? "").trim();

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return localizedJson(
      { error: "Username must be 3-20 characters (letters, numbers, underscore)" },
      { status: 400 },
    );
  }
  if (password.length < 12 || password.length > 256) {
    return localizedJson(
      { error: "Password must be 12-256 characters" },
      { status: 400 },
    );
  }
  if (displayName.length > 100) return localizedJson({ error: "显示名称不能超过 100 个字符" }, { status: 400 });

  const id = randomBytes(16).toString("hex");
  const rolePromise: Promise<string> = (async () => {
    try {
      // 用事务串行化写入：避免并发注册时多个请求同时看到 count=0 而同时成为管理员
      db.exec("BEGIN IMMEDIATE");

      const existing = db
        .prepare("SELECT id FROM users WHERE username = ?")
        .get(username);
      if (existing) {
        db.exec("ROLLBACK");
        throw Object.assign(new Error("Username already taken"), { status: 409 });
      }

      const count = (
        db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }
      ).c;

      if (count > 0 && !canRegister()) {
        db.exec("ROLLBACK");
        throw Object.assign(new Error("系统当前已关闭新用户注册，请联系管理员"), { status: 403 });
      }

      const role = count === 0 ? "admin" : "user";
      db.prepare(
        "INSERT INTO users (id, username, password_hash, display_name, role, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).run(
        id,
        username,
        hashPassword(password),
        displayName || username,
        role,
        "",
        Date.now(),
      );

      seedUserData(id);
      saveUserConfigs(id, { language });
      recordAuditLog({ userId: id, action: "auth.register.succeeded", target: id });
      db.exec("COMMIT");
      return role;
    } catch (err) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // already rolled back
      }
      throw err;
    }
  })();

  const role = await rolePromise.catch((err: unknown) => {
    const status = (err as { status?: number }).status || 500;
    const message =
      err instanceof Error ? err.message : status === 409 ? "用户名已存在" : "注册失败";
    return { error: message, status };
  });

  if (typeof role !== "string") {
    return localizedJson(
      { error: (role as { error: string }).error },
      { status: (role as { status: number }).status },
    );
  }

  const token = await createSession(id, req);
  const user = toPublicUser({
    id,
    username,
    password_hash: "",
    display_name: displayName || username,
    role,
    avatar: "",
    created_at: Date.now(),
  });

  const res = NextResponse.json({ user }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());

  return res;
}

export const GET = withRequestLogging("/api/auth/register", GETHandler);
export const POST = withRequestLogging("/api/auth/register", POSTHandler);
