import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db, SESSION_COOKIE } from "@/lib/db";
import { createSession, hashPassword, sessionCookieOptions, toPublicUser } from "@/lib/auth";
import { canRegister } from "@/lib/registration";
import { track } from "@/lib/analytics";

// GET /api/auth/register - 公开读取注册开关（登录页/注册页为未登录页面，无法走需 session 的 /api/user/data）。
// allowRegistration 是纯布尔策略，不含用户列表/用户名等敏感信息，且该状态本可经 POST 试探得出，故无需鉴权。
export async function GET() {
  return NextResponse.json({ allowRegistration: canRegister() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "")
    .trim()
    .toLowerCase();
  const password = String(body?.password ?? "");
  const displayName = String(body?.displayName ?? "").trim();

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-20 characters (letters, numbers, underscore)" },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 },
    );
  }

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
    return NextResponse.json(
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

  // 可选遥测：新用户注册
  track("auth.register", { userId: id, meta: { role } });

  return res;
}
