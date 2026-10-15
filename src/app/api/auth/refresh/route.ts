import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/db";
import { getSessionUser, renewSession, sessionCookieOptions } from "@/lib/auth";

/**
 * 在用户持续使用页面时延长会话。服务端仍以 sessions 表为准：
 * 被注销、过期或达到首次登录后 30 天硬上限的 token 都无法续期。
 */
async function POSTHandler() {
  const [user, cookieStore] = await Promise.all([getSessionUser(), cookies()]);
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!user || !token) {
    return localizedJson({ error: "未登录" }, { status: 401 });
  }

  const session = renewSession(token);
  if (!session) {
    return localizedJson({ error: "登录会话已失效" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, expiresAt: session.expiresAt });
  if (session.renewed) {
    res.cookies.set(
      SESSION_COOKIE,
      token,
      sessionCookieOptions(session.expiresAt - Date.now()),
    );
  }
  return res;
}

export const POST = withRequestLogging("/api/auth/refresh", POSTHandler);
