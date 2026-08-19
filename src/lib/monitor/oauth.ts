import crypto from "node:crypto";

export type MonitorProvider = "antigravity" | "codex";

export interface ProviderOAuthConfig {
  provider: MonitorProvider;
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  callbackPort: number;
  scopes: string[];
}

export const ANTIGRAVITY_OAUTH: ProviderOAuthConfig = {
  provider: "antigravity",
  authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  clientId: "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com",
  // client secret 存数据库（管理员后台配置），不放在 .env
  // 令牌交换/刷新时通过 getAntigravityClientSecret() 实时读取
  redirectUri: "http://localhost:51121/oauth-callback",
  callbackPort: 51121,
  scopes: [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/cclog",
    "https://www.googleapis.com/auth/experimentsandconfigs",
  ],
};

export const CODEX_OAUTH: ProviderOAuthConfig = {
  provider: "codex",
  authUrl: "https://auth.openai.com/oauth/authorize",
  tokenUrl: "https://auth.openai.com/oauth/token",
  clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
  redirectUri: "http://localhost:1455/auth/callback",
  callbackPort: 1455,
  scopes: ["openid", "email", "profile", "offline_access"],
};

export function getOAuthConfig(provider: MonitorProvider): ProviderOAuthConfig {
  return provider === "antigravity" ? ANTIGRAVITY_OAUTH : CODEX_OAUTH;
}

export interface PkceCodes {
  codeVerifier: string;
  codeChallenge: string;
}

export function generatePkce(): PkceCodes {
  const codeVerifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge: challenge };
}

export interface OAuthSession {
  state: string;
  provider: MonitorProvider;
  userId: string;
  pkceVerifier?: string;
  createdAt: number;
  status: "pending" | "done" | "error";
  error?: string;
  accountId?: string;
}

const globalStore = globalThis as unknown as {
  __navelixOAuthSessions?: Map<string, OAuthSession>;
};

function sessions(): Map<string, OAuthSession> {
  if (!globalStore.__navelixOAuthSessions) {
    globalStore.__navelixOAuthSessions = new Map();
  }
  return globalStore.__navelixOAuthSessions;
}

export function createOAuthSession(
  provider: MonitorProvider,
  userId: string,
  pkce?: PkceCodes,
): OAuthSession {
  const session: OAuthSession = {
    state: crypto.randomBytes(24).toString("hex"),
    provider,
    userId,
    pkceVerifier: pkce?.codeVerifier,
    createdAt: Date.now(),
    status: "pending",
  };
  sessions().set(session.state, session);
  return session;
}

export function getOAuthSession(state: string): OAuthSession | undefined {
  return sessions().get(state);
}

export function setOAuthSessionStatus(
  state: string,
  status: OAuthSession["status"],
  extra?: { error?: string; accountId?: string },
): void {
  const session = sessions().get(state);
  if (!session) return;
  session.status = status;
  if (extra?.error) session.error = extra.error;
  if (extra?.accountId) session.accountId = extra.accountId;
}

export function pruneExpiredOAuthSessions(now = Date.now()): void {
  const stale = 5 * 60 * 1000;
  for (const [state, session] of sessions()) {
    if (now - session.createdAt > stale) {
      sessions().delete(state);
    }
  }
}