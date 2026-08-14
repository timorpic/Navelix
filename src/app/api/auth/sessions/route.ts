import { NextResponse } from "next/server";
import { cookies } from "next/headers.js";
import { db, SESSION_COOKIE } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { createHash } from "node:crypto";
import { simpleRateLimit } from "@/lib/rate-limit";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface SessionItem {
  tokenHash: string;
  userAgent: string;
  ipAddress: string;
  lastActiveAt: number;
  createdAt: number;
  isCurrent: boolean;
}

// GET /api/auth/sessions - 获取当前用户所有活跃会话设备
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE)?.value || "";
  const currentHash = currentToken ? hashToken(currentToken) : "";

  const rows = db
    .prepare(
      `SELECT token_hash, user_agent, ip_address, last_active_at, created_at
       FROM sessions
       WHERE user_id = ? AND expires_at > ?
       ORDER BY last_active_at DESC`,
    )
    .all(user.id, Date.now()) as Array<{
    token_hash: string;
    user_agent: string;
    ip_address: string;
    last_active_at: number;
    created_at: number;
  }>;

  const sessions: SessionItem[] = rows.map((r) => ({
    tokenHash: r.token_hash,
    userAgent: r.user_agent || "未知设备/浏览器",
    ipAddress: r.ip_address || "未知 IP",
    lastActiveAt: r.last_active_at || r.created_at,
    createdAt: r.created_at,
    isCurrent: r.token_hash === currentHash,
  }));

  return NextResponse.json({ sessions });
}

// DELETE /api/auth/sessions - 踢出特定会话或注销其他所有设备
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 速率限制：防止会话 ID 暴力枚举或大规模注销（按用户维度 30 次/分钟）
  const rl = simpleRateLimit(`session-revoke:${user.id}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "操作过于频繁，请稍后再试", retryAfterMs: rl.retryAfterMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SESSION_COOKIE)?.value || "";
  const currentHash = currentToken ? hashToken(currentToken) : "";

  const body = await req.json().catch(() => null);
  const action = body?.action;
  const targetTokenHash = body?.tokenHash;

  if (action === "revoke_others") {
    db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").run(
      user.id,
      currentHash,
    );
    return NextResponse.json({
      success: true,
      message: "已注销其他所有设备的登录会话",
    });
  }

  if (targetTokenHash) {
    db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash = ?").run(
      user.id,
      targetTokenHash,
    );
    return NextResponse.json({
      success: true,
      message: "已安全强退选定的会话设备",
    });
  }

  return NextResponse.json({ error: "缺少操作参数" }, { status: 400 });
}
