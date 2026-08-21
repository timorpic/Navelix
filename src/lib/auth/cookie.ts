import { SESSION_TTL_MS } from "../db.ts";

// 会话 Cookie 配置：httpOnly + SameSite=Lax + 可选 Secure。
// 局域网 http 部署默认不启用 Secure（否则浏览器不回传 Cookie，导致反复登录）。
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
