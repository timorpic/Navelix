import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { ADMIN_PASSWORD_FILE, DATA_DIR_NAME } from "@/lib/constants";
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
import { sendTelegramNotification } from "@/lib/telegram";
import { isTelegramNotifySystemEnabled } from "@/lib/system-settings";
import { track } from "@/lib/analytics";

/** 登录失败达到该次数后向 Telegram 推送安全告警 */
const LOGIN_ALERT_THRESHOLD = 3;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "")
    .trim()
    .toLowerCase();
  const password = String(body?.password ?? "");

  const clientId = getClientId(req);
  // 叠加用户名作为二级限流 key：未开启 TRUST_PROXY 时所有请求落在
  // 全局 "direct-client" 桶，只有用户名维度可拆分，避免一个 IP 锁死全站
  const limitKey = username ? `${clientId}:${username}` : clientId;
  const { allowed, lockRemainingMs } = checkLoginRateLimit(limitKey);
  if (!allowed) {
    const minutes = Math.max(1, Math.ceil(lockRemainingMs / 60000));
    return NextResponse.json(
      { error: `尝试次数过多，请 ${minutes} 分钟后再试` },
      { status: 429 },
    );
  }

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
    recordLoginFailure(limitKey);
    const status = checkLoginRateLimit(limitKey);
    // 连续失败达到阈值：向 Telegram 推送登录异常安全告警
    if (status.remaining <= LOGIN_ALERT_THRESHOLD) {
      sendTelegramNotification(
        `🚨 Navelix 登录安全告警\n\n检测到对账号「${username}」的连续登录失败。\n${new Date().toLocaleString("zh-CN")}\n剩余允许尝试：${status.remaining} 次\n${status.lockRemainingMs > 0 ? `锁定中，剩余 ${Math.ceil(status.lockRemainingMs / 60000)} 分钟` : ""}`,
        isTelegramNotifySystemEnabled(),
      ).catch(() => {});
    }
    // 统一中文错误信息：避免通过语言差异泄露"用户是否存在"，同时兼容客户端提示
    return NextResponse.json(
      { error: "用户名或密码错误" },
      { status: 401 },
    );
  }

  resetLoginRateLimit(limitKey);
  // 管理员首次登录成功后自动删除初始密码提示文件
  if (row.role === "admin") {
    try {
      const pwdFile = path.join(process.cwd(), DATA_DIR_NAME, ADMIN_PASSWORD_FILE);
      if (fs.existsSync(pwdFile)) fs.unlinkSync(pwdFile);
    } catch {
      // 删除失败不影响登录
    }
  }

  const token = await createSession(row.id, req);
  const user = toPublicUser(row);
  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());

  // 可选遥测：登录成功（规范 wiki/Analytics §4.6）
  track("auth.login", {
    userId: row.id,
    meta: { outcome: "success", userRole: row.role },
  });

  return res;
}
