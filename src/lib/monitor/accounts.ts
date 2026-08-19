import { db } from "../db.ts";
import { encryptSecret, decryptSecret } from "../secret.ts";
import type { MonitorProvider } from "./oauth.ts";
import {
  fetchAntigravityCredits,
  fetchAntigravityQuotaSummary,
  refreshAntigravityToken,
  type AntigravityQuotaStatus,
  type AntigravityQuotaSummary,
  type AntigravityQuotaGroup,
} from "./providers/antigravity.ts";
import {
  fetchCodexUsage,
  parseCodexIdToken,
  refreshCodexToken,
  type CodexUsage,
} from "./providers/codex.ts";

export interface MonitorAccountRow {
  id: string;
  user_id: string;
  provider: string;
  email: string;
  label: string;
  access_token_enc: string;
  refresh_token_enc: string;
  id_token_enc: string;
  token_expires_at: number;
  plan_type: string;
  subscription_start: string;
  subscription_until: string;
  credits_amount: number | null;
  min_credit_amount: number | null;
  credits_known: number;
  project_id: string;
  quota_summary: string;
  last_error: string;
  last_checked_at: number;
  created_at: number;
  updated_at: number;
}

export interface MonitorAccountPublic {
  id: string;
  provider: string;
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
  quotaSummary: AntigravityQuotaSummary | null;
  codexUsage: CodexUsage | null;
  lastError: string;
  lastCheckedAt: number;
  createdAt: number;
}

export interface MonitorAccountInput {
  id?: string;
  provider: MonitorProvider;
  email: string;
  label: string;
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  tokenExpiresAt?: number;
  planType?: string;
  subscriptionStart?: string;
  subscriptionUntil?: string;
  projectId?: string;
}

const SELECT_COLS =
  "id, user_id, provider, email, label, access_token_enc, refresh_token_enc, id_token_enc, token_expires_at, plan_type, subscription_start, subscription_until, credits_amount, min_credit_amount, credits_known, project_id, quota_summary, last_error, last_checked_at, created_at, updated_at";

function parseQuotaSummary(raw: string): AntigravityQuotaSummary | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (Array.isArray(parsed.groups)) {
      return parsed as unknown as AntigravityQuotaSummary;
    }
    // 兼容旧版数据 → 归一化为 groups[].windows[] 结构
    const legacyWindows = parsed.windows as
      | Array<
          | {
              key?: "5h" | "weekly";
              label?: string;
              remainingFraction?: number | null;
              resetTime?: string;
              groups?: Array<{
                name?: string;
                shortName?: string;
                remainingFraction?: number | null;
                resetTime?: string;
              }>;
            }
          | null
          | undefined
        >
      | undefined;
    if (!Array.isArray(legacyWindows)) return null;
    const groupMap = new Map<string, AntigravityQuotaGroup>();
    for (const w of legacyWindows) {
      if (!w || !w.key) continue;
      const winKey = w.key as "5h" | "weekly";
      const winLabel = w.label || (w.key === "5h" ? "5H" : "7D");
      const legacyGroups = w.groups ?? [];
      const bars =
        legacyGroups.length > 0
          ? legacyGroups.map((g) => ({
              key: winKey,
              label: winLabel,
              remainingFraction: g?.remainingFraction ?? null,
              resetTime: g?.resetTime || "",
            }))
          : [
              {
                key: winKey,
                label: winLabel,
                remainingFraction: w.remainingFraction ?? null,
                resetTime: w.resetTime || "",
              },
            ];
      for (const bar of bars) {
        let name = "通用";
        const first = legacyGroups.find((g) => g && (g.name || g.shortName));
        if (first) {
          name = (first.name || first.shortName) || "通用";
        }
        const key = name;
        let grp = groupMap.get(key);
        if (!grp) {
          grp = { name, shortName: name, windows: [] };
          groupMap.set(key, grp);
        }
        grp.windows.push(bar);
      }
    }
    const groups = Array.from(groupMap.values());
    groups.sort((a, b) => (a.shortName < b.shortName ? -1 : 1));
    return {
      groups,
      buckets: [],
      fetchedAt: typeof parsed.fetchedAt === "number" ? parsed.fetchedAt : Date.now(),
      status: (parsed.status as AntigravityQuotaSummary["status"]) || undefined,
    };
  } catch {
    return null;
  }
}

function parseCodexUsage(raw: string): CodexUsage | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CodexUsage;
    if (typeof parsed.allowed !== "boolean") return null;
    return parsed;
  } catch {
    return null;
  }
}

function toPublic(row: MonitorAccountRow): MonitorAccountPublic {
  const quotaSummary = row.provider === "antigravity" ? parseQuotaSummary(row.quota_summary) : null;
  const codexUsage = row.provider === "codex" ? parseCodexUsage(row.quota_summary) : null;
  return {
    id: row.id,
    provider: row.provider,
    email: row.email,
    label: row.label,
    planType: row.plan_type,
    subscriptionStart: row.subscription_start,
    subscriptionUntil: row.subscription_until,
    creditsAmount: row.credits_amount,
    minCreditAmount: row.min_credit_amount,
    creditsKnown:
      row.provider === "antigravity" ? quotaSummary !== null : row.credits_known === 1,
    creditsAvailable:
      row.provider === "antigravity"
        ? !!(quotaSummary?.status?.googleOneActive)
        : row.credits_known === 1 &&
            row.credits_amount !== null &&
            row.min_credit_amount !== null &&
            row.credits_amount >= row.min_credit_amount,
    projectId: row.project_id,
    quotaSummary,
    codexUsage,
    lastError: row.last_error,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
  };
}

export function listMonitorAccounts(userId: string): MonitorAccountPublic[] {
  const rows = db
    .prepare(
      `SELECT ${SELECT_COLS} FROM model_accounts WHERE user_id = ? ORDER BY provider, created_at ASC`,
    )
    .all(userId) as unknown as MonitorAccountRow[];
  return rows.map(toPublic);
}

export function getMonitorAccount(
  userId: string,
  id: string,
): MonitorAccountRow | undefined {
  return db
    .prepare(
      `SELECT ${SELECT_COLS} FROM model_accounts WHERE user_id = ? AND id = ?`,
    )
    .get(userId, id) as MonitorAccountRow | undefined;
}

export function saveMonitorAccount(
  userId: string,
  input: MonitorAccountInput,
): string {
  const id = input.id || crypto.randomUUID();
  const now = Date.now();
  db.prepare(`
    INSERT INTO model_accounts (
      id, user_id, provider, email, label, access_token_enc, refresh_token_enc,
      id_token_enc, token_expires_at, plan_type, subscription_start,
      subscription_until, project_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      label = excluded.label,
      access_token_enc = excluded.access_token_enc,
      refresh_token_enc = excluded.refresh_token_enc,
      id_token_enc = excluded.id_token_enc,
      token_expires_at = excluded.token_expires_at,
      plan_type = excluded.plan_type,
      subscription_start = excluded.subscription_start,
      subscription_until = excluded.subscription_until,
      project_id = excluded.project_id,
      updated_at = excluded.updated_at
  `).run(
    id,
    userId,
    input.provider,
    input.email,
    input.label,
    encryptSecret(input.accessToken),
    encryptSecret(input.refreshToken || ""),
    encryptSecret(input.idToken || ""),
    input.tokenExpiresAt || 0,
    input.planType || "",
    input.subscriptionStart || "",
    input.subscriptionUntil || "",
    input.projectId || "",
    now,
    now,
  );
  return id;
}

export function deleteMonitorAccount(userId: string, id: string): boolean {
  const result = db
    .prepare("DELETE FROM model_accounts WHERE user_id = ? AND id = ?")
    .run(userId, id);
  return result.changes > 0;
}

export function updateMonitorCredits(
  id: string,
  credits: {
    creditAmount: number;
    minCreditAmount: number;
    paidTierId?: string;
    projectId?: string;
  },
): void {
  db.prepare(`
    UPDATE model_accounts SET
      credits_amount = ?,
      min_credit_amount = ?,
      project_id = ?,
      credits_known = 1,
      last_error = '',
      last_checked_at = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    credits.creditAmount,
    credits.minCreditAmount,
    credits.projectId || "",
    Date.now(),
    Date.now(),
    id,
  );
}

export function updateMonitorQuota(
  id: string,
  summary: AntigravityQuotaSummary,
): void {
  db.prepare(`
    UPDATE model_accounts SET
      quota_summary = ?,
      last_error = '',
      last_checked_at = ?,
      updated_at = ?
    WHERE id = ?
  `).run(JSON.stringify(summary), Date.now(), Date.now(), id);
}

export function updateMonitorError(id: string, error: string): void {
  db.prepare(`
    UPDATE model_accounts SET
      last_error = ?,
      last_checked_at = ?,
      updated_at = ?
    WHERE id = ?
  `).run(error, Date.now(), Date.now(), id);
}

export function updateMonitorTokens(
  id: string,
  tokens: { accessToken: string; refreshToken?: string; idToken?: string; tokenExpiresAt?: number },
): void {
  db.prepare(`
    UPDATE model_accounts SET
      access_token_enc = ?,
      refresh_token_enc = ?,
      id_token_enc = ?,
      token_expires_at = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    encryptSecret(tokens.accessToken),
    encryptSecret(tokens.refreshToken || ""),
    encryptSecret(tokens.idToken || ""),
    tokens.tokenExpiresAt || 0,
    Date.now(),
    id,
  );
}

function decryptTokens(row: MonitorAccountRow): {
  accessToken: string;
  refreshToken: string;
  idToken: string;
} {
  return {
    accessToken: decryptSecret(row.access_token_enc),
    refreshToken: decryptSecret(row.refresh_token_enc),
    idToken: decryptSecret(row.id_token_enc),
  };
}

export async function refreshMonitorAccount(
  userId: string,
  id: string,
): Promise<MonitorAccountPublic> {
  const row = getMonitorAccount(userId, id);
  if (!row) throw new Error("账号不存在");

  try {
    if (row.provider === "antigravity") {
      const tokens = decryptTokens(row);
      let accessToken = tokens.accessToken;
      if (
        !accessToken ||
        (row.token_expires_at > 0 && Date.now() >= row.token_expires_at - 60_000)
      ) {
        if (!tokens.refreshToken) {
          throw new Error("反重力 access_token 已过期且缺少 refresh_token");
        }
        const refreshed = await refreshAntigravityToken(tokens.refreshToken);
        accessToken = refreshed.access_token;
        updateMonitorTokens(id, {
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token || tokens.refreshToken,
          tokenExpiresAt: Date.now() + (refreshed.expires_in || 0) * 1000,
        });
      }
      const credits = await fetchAntigravityCredits(accessToken);
      updateMonitorCredits(id, {
        creditAmount: credits.creditAmount,
        minCreditAmount: credits.minCreditAmount,
        paidTierId: credits.paidTierId,
        projectId: credits.projectId,
      });
      const status: AntigravityQuotaStatus = {
        paidTierId: credits.paidTierId,
        paidTierName: credits.paidTierName,
        currentTierId: credits.currentTierId,
        googleOneActive: credits.available,
      };
      // 额度窗口：优先 5h/周窗口，失败回退按模型额度桶；
      // 即使全部失败也保存订阅状态，保证前台仍能显示"已启用"
      try {
        const summary = await fetchAntigravityQuotaSummary(
          accessToken,
          credits.projectId,
        );
        updateMonitorQuota(id, { ...summary, status });
      } catch (err) {
        console.warn(
          `[monitor] antigravity quota fetch failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        updateMonitorQuota(id, {
          groups: [],
          buckets: [],
          fetchedAt: Date.now(),
          status,
        });
      }
    } else if (row.provider === "codex") {
      const tokens = decryptTokens(row);
      if (tokens.refreshToken) {
        const refreshed = await refreshCodexToken(tokens.refreshToken);
        const claims = parseCodexIdToken(refreshed.id_token);
        updateMonitorTokens(id, {
          accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token || tokens.refreshToken,
          idToken: refreshed.id_token,
          tokenExpiresAt: Date.now() + (refreshed.expires_in || 0) * 1000,
        });
        let usage: CodexUsage | null = null;
        try {
          usage = await fetchCodexUsage(
            refreshed.access_token,
            claims.accountId,
          );
        } catch (err) {
          console.warn(
            `[monitor] codex usage fetch failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        db.prepare(`
          UPDATE model_accounts SET
            email = ?,
            plan_type = ?,
            subscription_start = ?,
            subscription_until = ?,
            quota_summary = ?,
            last_error = '',
            last_checked_at = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
          claims.email || row.email,
          (usage?.planType || claims.planType) || row.plan_type,
          claims.subscriptionStart || row.subscription_start,
          claims.subscriptionUntil || row.subscription_until,
          usage ? JSON.stringify(usage) : "",
          Date.now(),
          Date.now(),
          id,
        );
      } else {
        updateMonitorCredits(id, { creditAmount: 0, minCreditAmount: 0 });
      }
    }

    const updated = getMonitorAccount(userId, id);
    if (!updated) throw new Error("账号不存在");
    return toPublic(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateMonitorError(id, message);
    const updated = getMonitorAccount(userId, id);
    if (!updated) throw new Error("账号不存在");
    return toPublic(updated);
  }
}