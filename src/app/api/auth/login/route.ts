import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { db, SESSION_COOKIE } from "@/lib/db";
import {
  checkLoginRateLimit,
  createSession,
  getClientId,
  recordLoginFailure,
  resetLoginRateLimit,
  sessionCookieOptions,
  toPublicUser,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: Request) {
  const clientId = getClientId(req);
  const { allowed, lockRemainingMs } = checkLoginRateLimit(clientId);
  if (!allowed) {
    const minutes = Math.max(1, Math.ceil(lockRemainingMs / 60000));
    return NextResponse.json(
      { error: `尝试次数过多，请 ${minutes} 分钟后再试` },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "")
    .trim()
    .toLowerCase();
  const password = body?.password ?? "";

  const row = db
    .prepare(
      "SELECT id, username, password_hash, display_name, role, avatar, created_at FROM users WHERE username = ?",
    )
    .get(username) as
    | {
        id: string;
        username: string;
        password_hash: string;
        display_name: string;
        role: string;
        avatar: string;
        created_at: number;
      }
    | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    recordLoginFailure(clientId);
    // 统一中文错误信息：避免通过语言差异泄露"用户是否存在"，同时兼容客户端提示
    return NextResponse.json(
      { error: "用户名或密码错误" },
      { status: 401 },
    );
  }

  resetLoginRateLimit(clientId);
  // 管理员首次登录成功后自动删除初始密码提示文件
  if (row.role === "admin") {
    try {
      const pwdFile = path.join(process.cwd(), "data", "navelix-admin-password.txt");
      if (fs.existsSync(pwdFile)) fs.unlinkSync(pwdFile);
    } catch {
      // 删除失败不影响登录
    }
  }

  const token = await createSession(row.id);
  const user = toPublicUser(row);
  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
