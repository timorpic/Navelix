import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkCSRF } from "@/lib/csrf";
import { completeOAuthFlow } from "@/lib/monitor/complete-oauth";
import type { MonitorProvider } from "@/lib/monitor/oauth";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const csrfResult = checkCSRF(req);
  if (!csrfResult.success) {
    return NextResponse.json(
      { error: csrfResult.error || "CSRF 验证失败" },
      { status: csrfResult.status || 403 },
    );
  }

  let body: { provider?: unknown; callbackUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const provider = body.provider as MonitorProvider;
  if (provider !== "antigravity" && provider !== "codex") {
    return NextResponse.json({ error: "不支持的 provider" }, { status: 400 });
  }
  if (typeof body.callbackUrl !== "string" || !body.callbackUrl.trim()) {
    return NextResponse.json({ error: "请粘贴浏览器返回的回调地址" }, { status: 400 });
  }

  const result = await completeOAuthFlow(provider, body.callbackUrl.trim());
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "授权处理失败" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, accountId: result.accountId });
}