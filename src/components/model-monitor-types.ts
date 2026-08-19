export type MonitorProviderId = "antigravity" | "codex";

export interface QuotaWindowBar {
  key: "5h" | "weekly";
  label: string;
  remainingFraction: number | null;
  resetTime: string;
}

export interface QuotaGroup {
  name: string;
  shortName: string;
  windows: QuotaWindowBar[];
}

export interface QuotaStatus {
  paidTierId: string;
  paidTierName: string;
  currentTierId: string;
  googleOneActive: boolean;
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

export interface MonitorAccount {
  id: string;
  provider: MonitorProviderId;
  email: string;
  label: string;
  planType: string;
  subscriptionStart: string;
  subscriptionUntil: string;
  creditsAmount: number | null;
  minCreditAmount: number | null;
  creditsKnown: boolean;
  creditsAvailable: boolean;
  projectId: string;
  quotaSummary: {
    groups: QuotaGroup[];
    fetchedAt: number;
    status?: QuotaStatus;
  } | null;
  codexUsage: CodexUsage | null;
  lastError: string;
  lastCheckedAt: number;
  createdAt: number;
}

export interface ProviderMeta {
  label: string;
  shortLabel: string;
  icon: string;
  color: string;
  connectLabel: string;
  desc: string;
}

export const PROVIDER_META: Record<MonitorProviderId, ProviderMeta> = {
  antigravity: {
    label: "反重力 Antigravity",
    shortLabel: "反重力",
    icon: "🌀",
    color: "text-indigo-500",
    connectLabel: "连接反重力账号",
    desc: "Google OAuth 登录，展示订阅状态与调用额度窗口",
  },
  codex: {
    label: "Codex",
    shortLabel: "Codex",
    icon: "🧠",
    color: "text-teal-500",
    connectLabel: "连接 Codex 账号",
    desc: "OpenAI OAuth 登录，展示订阅方案与有效期",
  },
};