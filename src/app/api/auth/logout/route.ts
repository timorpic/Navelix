import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/db";
import { clearSessionCookieOptions, destroySession, getSessionUser } from "@/lib/auth";
import { track } from "@/lib/analytics";

export async function POST() {
  const cookieStore = await import("next/headers").then((m) => m.cookies());
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  // 销毁前先解析会话用户，用于可选遥测（规范 wiki/Analytics §4.6）
  const sessionUser = await getSessionUser().catch(() => null);

  if (token) await destroySession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());

  if (sessionUser) {
    track("auth.logout", { userId: sessionUser.id });
  }

  return res;
}
