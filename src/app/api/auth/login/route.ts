import { createHash } from "node:crypto";
import { recordAuditLog } from "@/lib/audit";
import { withRequestLogging } from "@/lib/logging/request";
import { translateText } from "@/lib/server-translations";
import { localizedJson } from "@/lib/localized-json";
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { ADMIN_PASSWORD_FILE } from "@/lib/constants";
import { resolveDataDir } from "@/lib/data-dir";
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
import { readLimitedJson, RequestBodyError } from "@/lib/request-body";
import { simpleRateLimit } from "@/lib/rate-limit";

/** 登录失败达到该次数后向 Telegram 推送安全告警 */
const LOGIN_ALERT_THRESHOLD = 3;

async function POSTHandler(req: Request) {
  const clientId = getClientId(req);
  const limit = simpleRateLimit(`login:${clientId}`, 60, 60_000);
  if (!limit.allowed) return localizedJson({ error: "登录尝试过于频繁，请稍后再试" }, {
    status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) },
  });
  let parsed: unknown;
  try { parsed = await readLimitedJson(req, 4096); }
  catch (error) {
    if (error instanceof RequestBodyError) return localizedJson({ error: error.message }, { status: error.status });
    throw error;
  }
  const body = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  if (!body || typeof body.username !== "string" || typeof body.password !== "string") {
    return localizedJson({ error: "无效的请求数据" }, { status: 400 });
  }
  const username = String(body?.username ?? "")
    .trim()
    .toLowerCase();
  const password = String(body?.password ?? "");
  if (username.length > 100 || password.length > 256) return localizedJson({ error: "登录信息长度超出限制" }, { status: 400 });

  // 叠加用户名作为二级限流 key：未开启 TRUST_PROXY 时所有请求落在
  // 全局 "direct-client" 桶，只有用户名维度可拆分，避免一个 IP 锁死全站
  const limitKey = username ? `${clientId}:${username}` : clientId;
  const { allowed, lockRemainingMs } = checkLoginRateLimit(limitKey);
  if (!allowed) {
    const minutes = Math.max(1, Math.ceil(lockRemainingMs / 60000));
    return localizedJson(
      { error: `尝试次数过多，请 ${minutes} 分钟后再试` },
      { status: 429 },
    );
  }

  const row = db
    .prepare(
      "SELECT id, username, password_hash, display_name, role, disabled, avatar, created_at FROM users WHERE username = ?",
    )
    .get(username) as
    | {
        id: string;
        username: string;
        password_hash: string;
        display_name: string;
        role: string;
        disabled: number;
        avatar: string;
        created_at: number;
      }
    | undefined;

  if (!row || !verifyPassword(password, row.password_hash)) {
    recordAuditLog({ userId: "", action: "auth.login.failed", outcome: "failed", target: createHash("sha256").update(username.slice(0, 100)).digest("hex") });
    recordLoginFailure(limitKey);
    const status = checkLoginRateLimit(limitKey);
    // 连续失败达到阈值：向 Telegram 推送登录异常安全告警
    if (status.remaining <= LOGIN_ALERT_THRESHOLD) {
      sendTelegramNotification(
        locale => translateText(locale, `🚨 Navelix 登录安全告警\n\n检测到对账号「${username}」的连续登录失败。\n${new Date().toLocaleString(locale)}\n剩余允许尝试：${status.remaining} 次\n${status.lockRemainingMs > 0 ? translateText(locale, `锁定中，剩余 ${Math.ceil(status.lockRemainingMs / 60000)} 分钟`) : ""}`),
        "system",
      ).catch(() => {});
    }
    // 统一中文错误信息：避免通过语言差异泄露"用户是否存在"，同时兼容客户端提示
    return localizedJson(
      { error: "用户名或密码错误" },
      { status: 401 },
    );
  }

  if (row.disabled) return localizedJson({ error: "账号已停用，请联系管理员" }, { status: 403 });

  resetLoginRateLimit(limitKey);
  // 管理员首次登录成功后自动删除初始密码提示文件
  if (row.role === "admin") {
    try {
      const pwdFile = path.join(resolveDataDir(), ADMIN_PASSWORD_FILE);
      if (fs.existsSync(pwdFile)) fs.unlinkSync(pwdFile);
    } catch {
      // 删除失败不影响登录
    }
  }

  let token: string;
  try { token = await createSession(row.id, req); }
  catch { return localizedJson({ error: "账号不可用，请重新登录或联系管理员" }, { status: 403 }); }
  const user = toPublicUser(row);
  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());

  return res;
}

export const POST = withRequestLogging("/api/auth/login", POSTHandler);
