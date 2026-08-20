import { ANTIGRAVITY_OAUTH } from "../oauth.ts";
import { getAntigravityClientSecret } from "../../system-settings.ts";

/**
 * loadCodeAssist / retrieveUserQuotaSummary / fetchAvailableModels 会按客户端类型
 * 返回不同数据。必须用 Antigravity Hub 客户端 UA（antigravity/hub/x.y.z）才会返回
 * 完整响应（paidTier / cloudaicompanionProject / 5h+周额度窗口）；
 * 其它 UA（含浏览器）只返回精简数据或 403。
 */
const ANTIGRAVITY_USER_AGENT = "antigravity/hub/2.2.1 darwin/arm64";

export interface AntigravityTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface AntigravityCredits {
  paidTierId: string;
  paidTierName: string;
  currentTierId: string;
  creditAmount: number;
  minCreditAmount: number;
  available: boolean;
  /** 反重力项目 ID，用于查询额度窗口（CLIProxyAPI extractCloudaicompanionProject） */
  projectId: string;
}

export interface AntigravityQuotaStatus {
  /** paidTier.id（如 g1-pro-tier），无订阅为空字符串 */
  paidTierId: string;
  paidTierName: string;
  currentTierId: string;
  /** 是否已启用 Google One AI Pro / Gemini Code Assist 付费档 */
  googleOneActive: boolean;
}

export interface AntigravityQuotaBucket {
  bucketId: string;
  label: string;
  /** 剩余比例 0~1；未知为 null */
  remainingFraction: number | null;
  /** ISO 重置时间，可能为空 */
  resetTime: string;
  description: string;
}

export interface AntigravityQuotaWindowBar {
  key: "5h" | "weekly";
  /** 展示标签（如 "5H" / "7D"） */
  label: string;
  remainingFraction: number | null;
  resetTime: string;
}

export interface AntigravityQuotaGroup {
  /** 模型组显示名（如 "Gemini Models" / "Claude and GPT models"） */
  name: string;
  /** 短名（如 "Gemini" / "Claude"），用于紧凑展示 */
  shortName: string;
  /** 该组下的额度窗口（5H / 7D） */
  windows: AntigravityQuotaWindowBar[];
}

export interface AntigravityQuotaSummary {
  groups: AntigravityQuotaGroup[];
  buckets: AntigravityQuotaBucket[];
  fetchedAt: number;
  status?: AntigravityQuotaStatus;
}

export interface AntigravityUserInfo {
  email: string;
}

export function buildAntigravityAuthUrl(state: string, redirectUri?: string): string {
  const params = new URLSearchParams();
  params.set("access_type", "offline");
  params.set("client_id", ANTIGRAVITY_OAUTH.clientId);
  params.set("prompt", "consent");
  params.set("redirect_uri", redirectUri || ANTIGRAVITY_OAUTH.redirectUri);
  params.set("response_type", "code");
  params.set("scope", ANTIGRAVITY_OAUTH.scopes.join(" "));
  params.set("state", state);
  return `${ANTIGRAVITY_OAUTH.authUrl}?${params.toString()}`;
}

export async function exchangeAntigravityCode(
  code: string,
  redirectUri: string,
): Promise<AntigravityTokenResponse> {
  const body = new URLSearchParams();
  body.set("code", code);
  body.set("client_id", ANTIGRAVITY_OAUTH.clientId);
  body.set("client_secret", getAntigravityClientSecret());
  body.set("redirect_uri", redirectUri);
  body.set("grant_type", "authorization_code");

  const resp = await fetch(ANTIGRAVITY_OAUTH.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`antigravity token exchange failed: ${resp.status} ${text}`);
  }
  return (await resp.json()) as AntigravityTokenResponse;
}

export async function refreshAntigravityToken(
  refreshToken: string,
): Promise<AntigravityTokenResponse> {
  const body = new URLSearchParams();
  body.set("refresh_token", refreshToken);
  body.set("client_id", ANTIGRAVITY_OAUTH.clientId);
  body.set("client_secret", getAntigravityClientSecret());
  body.set("grant_type", "refresh_token");

  const resp = await fetch(ANTIGRAVITY_OAUTH.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`antigravity token refresh failed: ${resp.status} ${text}`);
  }
  return (await resp.json()) as AntigravityTokenResponse;
}

export async function fetchAntigravityUserInfo(
  accessToken: string,
): Promise<AntigravityUserInfo> {
  const resp = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo?alt=json",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`antigravity userinfo failed: ${resp.status} ${text}`);
  }
  const data = (await resp.json()) as { email?: string };
  return { email: data.email || "" };
}

export async function fetchAntigravityCredits(
  accessToken: string,
  baseUrl = "https://cloudcode-pa.googleapis.com",
): Promise<AntigravityCredits> {
  const resp = await fetch(`${baseUrl}/v1internal:loadCodeAssist`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "*/*",
      "User-Agent": ANTIGRAVITY_USER_AGENT,
    },
    body: JSON.stringify({ metadata: { ideType: "ANTIGRAVITY" } }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`antigravity loadCodeAssist failed: ${resp.status} ${text}`);
  }
  const data = (await resp.json()) as {
    paidTier?: {
      id?: string;
      name?: string;
      availableCredits?: Array<{
        creditType?: string;
        creditAmount?: number | string;
        minimumCreditAmountForUsage?: number | string;
      }>;
    };
    currentTier?: { id?: string };
    // CLIProxyAPI extractCloudaicompanionProject：优先 cloudaicompanionProject，
    // 其次 projectId，最后 project.id
    cloudaicompanionProject?: string;
    projectId?: string;
    project?: { id?: string };
  };

  const paidTier = data.paidTier;
  const paidTierId = paidTier?.id || "";
  const paidTierName = paidTier?.name || "";
  const currentTierId = data.currentTier?.id || "";
  const credits = paidTier?.availableCredits || [];
  const g1 = credits.find(
    (c) => (c.creditType || "").toUpperCase() === "GOOGLE_ONE_AI",
  );

  // 新版 Antigravity 响应不携带 creditAmount（额度改由 5h/周窗口管控），
  // 此时与 CLIProxyAPI 一致按 paidTier 存在与否判定订阅是否启用。
  const creditAmount = Number(g1?.creditAmount);
  if (g1 && Number.isFinite(creditAmount)) {
    const minCreditAmount = Number(g1?.minimumCreditAmountForUsage) || 0;
    return {
      paidTierId,
      paidTierName,
      currentTierId,
      creditAmount,
      minCreditAmount,
      available: creditAmount >= minCreditAmount,
      projectId: extractCloudAiCompanionProject(data),
    };
  }

  return {
    paidTierId,
    paidTierName,
    currentTierId,
    creditAmount: 0,
    minCreditAmount: Number(g1?.minimumCreditAmountForUsage) || 0,
    available: paidTierId !== "",
    projectId: extractCloudAiCompanionProject(data),
  };
}

/**
 * 从 loadCodeAssist 响应中提取反重力项目 ID，与 CLIProxyAPI
 * internal/auth/antigravity/auth.go 的 extractCloudaicompanionProject 保持一致。
 */
export function extractCloudAiCompanionProject(data: {
  cloudaicompanionProject?: string;
  projectId?: string;
  project?: { id?: string };
}): string {
  if (typeof data.cloudaicompanionProject === "string" && data.cloudaicompanionProject !== "") {
    return data.cloudaicompanionProject;
  }
  if (typeof data.projectId === "string" && data.projectId !== "") {
    return data.projectId;
  }
  if (data.project && typeof data.project.id === "string" && data.project.id !== "") {
    return data.project.id;
  }
  return "";
}

interface RawQuotaBucket {
  bucketId?: unknown;
  displayName?: unknown;
  description?: unknown;
  resetTime?: unknown;
  remainingFraction?: unknown;
  remaining?: { remainingFraction?: unknown } | null;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function readQuotaBucket(b: RawQuotaBucket): AntigravityQuotaBucket {
  const nested = b.remaining && typeof b.remaining === "object"
    ? toNumber(b.remaining.remainingFraction)
    : null;
  const remainingFraction = nested ?? toNumber(b.remainingFraction);
  const bucketId = typeof b.bucketId === "string" ? b.bucketId : "";
  return {
    bucketId,
    label: typeof b.displayName === "string" ? b.displayName : bucketId,
    remainingFraction,
    resetTime: typeof b.resetTime === "string" ? b.resetTime : "",
    description: typeof b.description === "string" ? b.description : "",
  };
}

/** 从模型组显示名派生紧凑标签（如 "Gemini Models"→Gemini，"Claude and GPT models"→Claude） */
function shortGroupName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("gemini")) return "Gemini";
  if (lower.includes("claude")) return "Claude";
  if (lower.includes("gpt") || lower.includes("3p") || lower.includes("third")) {
    return "Claude + GPT";
  }
  return name || "通用";
}

const WINDOW_MATCHERS: Array<{
  key: AntigravityQuotaWindowBar["key"];
  test: (s: string) => boolean;
}> = [
  {
    key: "weekly",
    test: (s) => /\bweekly\b|\bweek\b|7\s?d\b|7\s?day|周/i.test(s),
  },
  {
    key: "5h",
    test: (s) =>
      /\b(5h|5\s?hr|5\s?hours|5小时)\b|session/i.test(s) && !/\bweekly\b|\bweek\b|7\s?d\b|7\s?day|周/i.test(s),
  },
];

interface RawQuotaGroup {
  displayName?: unknown;
  buckets?: RawQuotaBucket[];
}

/** 从一组桶中提取 5H / 7D 两个窗口条（每组自己的额度） */
function buildWindowBars(buckets: AntigravityQuotaBucket[]): AntigravityQuotaWindowBar[] {
  const bars: AntigravityQuotaWindowBar[] = [];
  for (const { key, test } of WINDOW_MATCHERS) {
    const matches = buckets.filter((b) =>
      test(`${b.bucketId} ${b.label} ${b.description}`),
    );
    if (matches.length === 0) continue;
    let bestFraction: number | null = null;
    let resetTime = "";
    for (const b of matches) {
      if (b.remainingFraction !== null &&
          (bestFraction === null || b.remainingFraction < bestFraction)) {
        bestFraction = b.remainingFraction;
      }
      if (!resetTime && b.resetTime) resetTime = b.resetTime;
    }
    bars.push({
      key,
      label: key === "5h" ? "5H" : "7D",
      remainingFraction: bestFraction,
      resetTime,
    });
  }
  bars.sort((a) => (a.key === "5h" ? -1 : 1));
  return bars;
}

/** 解析 retrieveUserQuotaSummary 响应（groups[].buckets[] 或顶层 buckets[] 两种结构） */
export function parseQuotaSummary(
  data: unknown,
  fetchedAt = Date.now(),
): AntigravityQuotaSummary {
  const raw = data as { groups?: RawQuotaGroup[]; buckets?: RawQuotaBucket[] } | null;
  const buckets: AntigravityQuotaBucket[] = [];
  // 模型组显示名 → 该组的桶（用于按组拆分展示）
  const bucketsByGroup = new Map<string, AntigravityQuotaBucket[]>();
  if (raw && Array.isArray(raw.groups)) {
    for (const g of raw.groups) {
      if (!g || !Array.isArray(g.buckets)) continue;
      const display = typeof g.displayName === "string" ? g.displayName : "";
      const list: AntigravityQuotaBucket[] = [];
      for (const b of g.buckets) {
        const bucket = readQuotaBucket(b);
        buckets.push(bucket);
        list.push(bucket);
      }
      bucketsByGroup.set(display, list);
    }
  } else if (raw && Array.isArray(raw.buckets)) {
    for (const b of raw.buckets) buckets.push(readQuotaBucket(b));
  }

  const groups: AntigravityQuotaGroup[] = [];
  if (bucketsByGroup.size === 0) {
    // 顶层 buckets[] 结构（无分组）→ 归为单个"通用"组
    const bars = buildWindowBars(buckets);
    if (bars.length > 0) {
      groups.push({ name: "通用", shortName: "通用", windows: bars });
    }
  } else {
    for (const [gn, gBuckets] of bucketsByGroup) {
      const bars = buildWindowBars(gBuckets);
      if (bars.length === 0) continue;
      groups.push({
        name: gn || "通用",
        shortName: shortGroupName(gn),
        windows: bars,
      });
    }
  }
  groups.sort((a, b) => (a.shortName < b.shortName ? -1 : 1));

  return { groups, buckets, fetchedAt };
}

/**
 * 查询反重力 5 小时 / 周额度窗口（retrieveUserQuotaSummary）。
 * 必须携带 Antigravity Hub UA 才能访问；请求体携带 project（与 CLIProxyAPI 一致）。
 */
export async function fetchAntigravityQuotaSummary(
  accessToken: string,
  projectId: string,
): Promise<AntigravityQuotaSummary> {
  const bases = [
    "https://cloudcode-pa.googleapis.com",
    "https://daily-cloudcode-pa.googleapis.com",
  ];
  const projectBody = projectId ? { project: projectId } : {};
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Accept: "*/*",
    "User-Agent": ANTIGRAVITY_USER_AGENT,
  };
  let lastError = "";
  for (const base of bases) {
    try {
      const resp = await fetch(`${base}/v1internal:retrieveUserQuotaSummary`, {
        method: "POST",
        headers,
        body: JSON.stringify(projectBody),
      });
      if (!resp.ok) {
        lastError = `${resp.status}`;
        continue;
      }
      const summary = parseQuotaSummary(await resp.json());
      if (summary.groups.length > 0) {
        return summary;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(
    `antigravity retrieveUserQuotaSummary failed: ${lastError || "no window data"}`,
  );
}