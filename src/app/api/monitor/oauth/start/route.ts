import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkCSRF } from "@/lib/csrf";
import {
  createOAuthSession,
  generatePkce,
  getOAuthConfig,
  pruneExpiredOAuthSessions,
  type MonitorProvider,
} from "@/lib/monitor/oauth";
import { buildAntigravityAuthUrl } from "@/lib/monitor/providers/antigravity";
import { buildCodexAuthUrl } from "@/lib/monitor/providers/codex";

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

  let body: { provider?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const provider = body.provider as MonitorProvider;
  if (provider !== "antigravity" && provider !== "codex") {
    return NextResponse.json({ error: "不支持的 provider" }, { status: 400 });
  }

  pruneExpiredOAuthSessions();

  let session;
  let authUrl: string;
  if (provider === "antigravity") {
    session = createOAuthSession("antigravity", user.id);
    authUrl = buildAntigravityAuthUrl(session.state);
  } else {
    const pkce = generatePkce();
    session = createOAuthSession("codex", user.id, pkce);
    authUrl = buildCodexAuthUrl(session.state, pkce);
  }

  return NextResponse.json({
    url: authUrl,
    state: session.state,
    redirectUri: getOAuthConfig(provider).redirectUri,
  });
}