import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  currentSessionHash,
  listSessions,
  revokeOtherSessions,
  revokeSession,
} from "@/lib/auth/sessions";
import { simpleRateLimit } from "@/lib/rate-limit";

export type { SessionItem } from "@/lib/auth/sessions";

// GET /api/auth/sessions - 获取当前用户所有活跃会话设备
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const currentHash = await currentSessionHash();
  return NextResponse.json({ sessions: listSessions(user.id, currentHash) });
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

  const currentHash = await currentSessionHash();
  const body = await req.json().catch(() => null);
  const action = body?.action;
  const targetTokenHash = body?.tokenHash;

  if (action === "revoke_others") {
    revokeOtherSessions(user.id, currentHash);
    return NextResponse.json({
      success: true,
      message: "已注销其他所有设备的登录会话",
    });
  }

  if (targetTokenHash) {
    revokeSession(user.id, String(targetTokenHash));
    return NextResponse.json({
      success: true,
      message: "已安全强退选定的会话设备",
    });
  }

  return NextResponse.json({ error: "缺少操作参数" }, { status: 400 });
}
