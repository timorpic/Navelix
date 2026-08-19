import { CODEX_OAUTH } from "../oauth.ts";
import type { PkceCodes } from "../oauth.ts";

export interface CodexTokenData {
  access_token: string;
  refresh_token?: string;
  id_token: string;
  token_type: string;
  expires_in: number;
}

export interface CodexClaims {
  email: string;
  planType: string;
  subscriptionStart: string;
  subscriptionUntil: string;
  accountId: string;
}

export interface CodexUsageWindow {
  usedPercent: number | null;
  windowSeconds: number | null;
  resetAfterSeconds: number | null;
  resetAt: number | null;
}

export interface CodexUsage {
  planType: string;
  allowed: boolean;
  limitReached: boolean;
  primaryWindow: CodexUsageWindow | null;
  secondaryWindow: CodexUsageWindow | null;
  codeReviewRateLimit: CodexUsageWindow | null;
  additionalRateLimits: CodexUsageWindow[];
  credits: {
    hasCredits: boolean;
    unlimited: boolean;
    balance: number | null;
    approxLocalMessages: number | null;
    approxCloudMessages: number | null;
  };
  fetchedAt: number;
}

export function buildCodexAuthUrl(state: string, pkce: PkceCodes): string {
  const params = new URLSearchParams();
  params.set("client_id", CODEX_OAUTH.clientId);
  params.set("response_type", "code");
  params.set("redirect_uri", CODEX_OAUTH.redirectUri);
  params.set("scope", CODEX_OAUTH.scopes.join(" "));
  params.set("state", state);
  params.set("code_challenge", pkce.codeChallenge);
  params.set("code_challenge_method", "S256");
  params.set("prompt", "login");
  params.set("id_token_add_organizations", "true");
  params.set("codex_cli_simplified_flow", "true");
  return `${CODEX_OAUTH.authUrl}?${params.toString()}`;
}

export async function exchangeCodexCode(
  code: string,
  pkce: PkceCodes,
): Promise<CodexTokenData> {
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", CODEX_OAUTH.clientId);
  body.set("code", code);
  body.set("redirect_uri", CODEX_OAUTH.redirectUri);
  body.set("code_verifier", pkce.codeVerifier);

  const resp = await fetch(CODEX_OAUTH.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`codex token exchange failed: ${resp.status} ${text}`);
  }
  return (await resp.json()) as CodexTokenData;
}

export async function refreshCodexToken(
  refreshToken: string,
): Promise<CodexTokenData> {
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("client_id", CODEX_OAUTH.clientId);
  body.set("refresh_token", refreshToken);
  body.set("scope", "openid profile email");

  const resp = await fetch(CODEX_OAUTH.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`codex token refresh failed: ${resp.status} ${text}`);
  }
  return (await resp.json()) as CodexTokenData;
}

function base64UrlDecode(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

interface RawWhamWindow {
  used_percent?: number | null;
  limit_window_seconds?: number | null;
  reset_after_seconds?: number | null;
  reset_at?: number | null;
}

function readWindow(w: RawWhamWindow | null | undefined): CodexUsageWindow | null {
  if (!w) return null;
  return {
    usedPercent:
      typeof w.used_percent === "number" && Number.isFinite(w.used_percent)
        ? w.used_percent
        : null,
    windowSeconds:
      typeof w.limit_window_seconds === "number" && Number.isFinite(w.limit_window_seconds)
        ? w.limit_window_seconds
        : null,
    resetAfterSeconds:
      typeof w.reset_after_seconds === "number" && Number.isFinite(w.reset_after_seconds)
        ? w.reset_after_seconds
        : null,
    resetAt:
      typeof w.reset_at === "number" && Number.isFinite(w.reset_at) ? w.reset_at : null,
  };
}

/** 拉取 ChatGPT 账号的 Codex 用量/额度（30D 月度窗口等），对齐 CLIProxyAPI 展示 */
export async function fetchCodexUsage(
  accessToken: string,
  accountId: string,
): Promise<CodexUsage> {
  const resp = await fetch("https://chatgpt.com/backend-api/wham/usage", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "ChatGPT-Account-Id": accountId,
      Accept: "application/json",
    },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`codex usage fetch failed: ${resp.status} ${text.slice(0, 200)}`);
  }
  const raw = (await resp.json()) as {
    plan_type?: string;
    rate_limit?: {
      allowed?: boolean;
      limit_reached?: boolean;
      primary_window?: RawWhamWindow | null;
      secondary_window?: RawWhamWindow | null;
    };
    code_review_rate_limit?: RawWhamWindow | null;
    additional_rate_limits?: RawWhamWindow[] | null;
    credits?: {
      has_credits?: boolean;
      unlimited?: boolean;
      balance?: number | null;
      approx_local_messages?: number | null;
      approx_cloud_messages?: number | null;
    };
  };
  return {
    planType: raw.plan_type || "",
    allowed: raw.rate_limit?.allowed === true,
    limitReached: raw.rate_limit?.limit_reached === true,
    primaryWindow: readWindow(raw.rate_limit?.primary_window),
    secondaryWindow: readWindow(raw.rate_limit?.secondary_window),
    codeReviewRateLimit: readWindow(raw.code_review_rate_limit),
    additionalRateLimits: (raw.additional_rate_limits ?? []).map(readWindow).filter(
      (w): w is CodexUsageWindow => w !== null,
    ),
    credits: {
      hasCredits: raw.credits?.has_credits === true,
      unlimited: raw.credits?.unlimited === true,
      balance:
        typeof raw.credits?.balance === "number" ? raw.credits.balance : null,
      approxLocalMessages:
        typeof raw.credits?.approx_local_messages === "number"
          ? raw.credits.approx_local_messages
          : null,
      approxCloudMessages:
        typeof raw.credits?.approx_cloud_messages === "number"
          ? raw.credits.approx_cloud_messages
          : null,
    },
    fetchedAt: Date.now(),
  };
}

/** 窗口时长 → 展示标签（5H/24H/7D/30D 等） */
export function codexWindowLabel(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "窗口";
  const days = seconds / 86400;
  if (Math.abs(days - 365) < 1) return "1Y";
  if (Math.abs(days - 30) < 1) return "30D";
  if (Math.abs(days - 7) < 1) return "7D";
  if (Math.abs(days - 1) < 0.1) return "24H";
  const hours = seconds / 3600;
  if (Math.abs(hours - 5) < 0.1) return "5H";
  if (days >= 1) return `${Math.round(days)}D`;
  return `${Math.round(hours)}H`;
}

export function parseCodexIdToken(idToken: string): CodexClaims {
  const claims: CodexClaims = {
    email: "",
    planType: "",
    subscriptionStart: "",
    subscriptionUntil: "",
    accountId: "",
  };
  if (!idToken) return claims;

  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return claims;
    const payload = JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>;
    const authInfo = (payload["https://api.openai.com/auth"] || {}) as Record<
      string,
      unknown
    >;

    claims.email = String(payload.email || "");
    claims.accountId = String(authInfo.chatgpt_account_id || "");
    claims.planType = String(authInfo.chatgpt_plan_type || "");
    const start = authInfo.chatgpt_subscription_active_start;
    const until = authInfo.chatgpt_subscription_active_until;
    claims.subscriptionStart = formatDate(start);
    claims.subscriptionUntil = formatDate(until);
  } catch {
    // JWT 解析失败时保留空值，不抛出
  }
  return claims;
}

function formatDate(value: unknown): string {
  if (value === undefined || value === null) return "";
  const ts = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(ts) || ts <= 0) return "";
  const d = new Date(ts * 1000);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}