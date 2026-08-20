import { getOAuthConfig, getOAuthSession, setOAuthSessionStatus, type MonitorProvider } from "./oauth.ts";
import { saveMonitorAccount } from "./accounts.ts";
import { exchangeAntigravityCode, fetchAntigravityUserInfo } from "./providers/antigravity.ts";
import { exchangeCodexCode, parseCodexIdToken } from "./providers/codex.ts";

export interface CompleteOAuthResult {
  ok: boolean;
  error?: string;
  accountId?: string;
}

export function completeOAuthFlow(
  provider: MonitorProvider,
  callbackUrl: string,
  requesterId: string,
): Promise<CompleteOAuthResult> {
  let parsed: URL;
  try {
    parsed = new URL(callbackUrl);
  } catch {
    return Promise.resolve({ ok: false, error: "回调地址格式无效" });
  }

  const state = parsed.searchParams.get("state") || "";
  const code = parsed.searchParams.get("code") || "";
  const errorParam = parsed.searchParams.get("error") || "";

  if (!state) {
    return Promise.resolve({ ok: false, error: "回调地址缺少 state 参数" });
  }
  if (!code && !errorParam) {
    return Promise.resolve({ ok: false, error: "回调地址缺少 code 参数" });
  }

  const session = getOAuthSession(state);
  if (!session) {
    return Promise.resolve({ ok: false, error: "会话不存在或已过期，请重新发起授权" });
  }
  if (session.provider !== provider) {
    return Promise.resolve({ ok: false, error: "会话状态与当前 provider 不匹配，请重新发起授权" });
  }
  if (session.userId !== requesterId) {
    return Promise.resolve({ ok: false, error: "会话不属于当前用户，请重新发起授权" });
  }
  if (session.status === "done") {
    return Promise.resolve({ ok: true, accountId: session.accountId });
  }
  if (session.status === "processing") {
    return Promise.resolve({ ok: false, error: "该回调正在处理中，请勿重复提交" });
  }
  setOAuthSessionStatus(state, "processing");
  if (errorParam) {
    setOAuthSessionStatus(state, "error", { error: `授权被拒绝: ${errorParam}` });
    return Promise.resolve({ ok: false, error: `授权被拒绝: ${errorParam}` });
  }

  return (async () => {
    try {
      if (provider === "antigravity") {
        const cfg = getOAuthConfig("antigravity");
        const token = await exchangeAntigravityCode(code, cfg.redirectUri);
        let email = "";
        try {
          const info = await fetchAntigravityUserInfo(token.access_token);
          email = info.email;
        } catch {
          // 用户信息获取失败不阻断授权
        }
        const accountId = saveMonitorAccount(session.userId, {
          provider: "antigravity",
          email,
          label: email || "反重力账号",
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          tokenExpiresAt: Date.now() + (token.expires_in || 0) * 1000,
        });
        setOAuthSessionStatus(state, "done", { accountId });
        return { ok: true, accountId };
      }

      if (!session.pkceVerifier) {
        setOAuthSessionStatus(state, "error", { error: "PKCE verifier 缺失，请重新发起授权" });
        return { ok: false, error: "PKCE verifier 缺失，请重新发起授权" };
      }
      const token = await exchangeCodexCode(code, {
        codeVerifier: session.pkceVerifier,
        codeChallenge: "",
      });
      const claims = parseCodexIdToken(token.id_token);
      const accountId = saveMonitorAccount(session.userId, {
        provider: "codex",
        email: claims.email,
        label: claims.email || "Codex 账号",
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        idToken: token.id_token,
        tokenExpiresAt: Date.now() + (token.expires_in || 0) * 1000,
        planType: claims.planType,
        subscriptionStart: claims.subscriptionStart,
        subscriptionUntil: claims.subscriptionUntil,
      });
      setOAuthSessionStatus(state, "done", { accountId });
      return { ok: true, accountId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setOAuthSessionStatus(state, "error", { error: message });
      return { ok: false, error: message };
    }
  })();
}