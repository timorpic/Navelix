"use client";

import React, { useCallback, useEffect, useState } from "react";

interface QuotaWindowBar {
  key: "5h" | "weekly";
  label: string;
  remainingFraction: number | null;
  resetTime: string;
}

interface QuotaGroup {
  name: string;
  shortName: string;
  windows: QuotaWindowBar[];
}

interface QuotaStatus {
  paidTierId: string;
  paidTierName: string;
  currentTierId: string;
  googleOneActive: boolean;
}

interface CodexUsageWindow {
  usedPercent: number | null;
  windowSeconds: number | null;
  resetAfterSeconds: number | null;
  resetAt: number | null;
}

interface CodexUsage {
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

interface WidgetAccount {
  id: string;
  provider: "antigravity" | "codex";
  label: string;
  email: string;
  planType: string;
  subscriptionUntil: string;
  creditsKnown: boolean;
  creditsAvailable: boolean;
  quotaSummary: {
    groups: QuotaGroup[];
    status?: QuotaStatus;
  } | null;
  codexUsage: CodexUsage | null;
  lastError: string;
}

function formatResetTime(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = t - Date.now();
  if (diff <= 0) return "已到重置时间";
  const days = Math.floor(diff / 86400_000);
  const hours = Math.floor((diff % 86400_000) / 3600_000);
  const mins = Math.floor((diff % 3600_000) / 60_000);
  if (days > 0) return `${days}天 ${hours}小时后重置`;
  return hours > 0 ? `${hours}h ${mins}m 后重置` : `${mins}m 后重置`;
}

export default function ModelMonitorWidget() {
  const [accounts, setAccounts] = useState<WidgetAccount[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/monitor/accounts");
      const data = await res.json();
      if (Array.isArray(data.accounts)) setAccounts(data.accounts);
    } catch {
      // ignore
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("navelix-workspace-updated", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("navelix-workspace-updated", onFocus);
    };
  }, [load]);

  const refreshAll = async () => {
    setRefreshing(true);
    try {
      for (const a of accounts) {
        await fetch("/api/monitor/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: a.id }),
        }).catch(() => null);
      }
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  if (!loaded) return null;
  const antigravity = accounts.filter((a) => a.provider === "antigravity");
  const codex = accounts.filter((a) => a.provider === "codex");
  if (antigravity.length === 0 && codex.length === 0) return null;

  return (
    <div className="rounded-2xl p-4 bg-white/90 dark:bg-slate-900/70 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-3 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🧠</span>
          <div>
            <h3 className="text-xs font-black text-gray-900 dark:text-white tracking-wide">模型监控</h3>
            <p className="text-[10px] text-gray-400 dark:text-slate-500">账号与调用额度</p>
          </div>
        </div>
        <button
          onClick={refreshAll}
          disabled={refreshing}
          className="text-gray-400 hover:text-[#00C776] disabled:opacity-40 transition-colors cursor-pointer text-xs"
          title="刷新全部额度"
        >
          {refreshing ? "⏳" : "🔄"}
        </button>
      </div>

      {antigravity.map((a) => (
        <div key={a.id} className="rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm text-indigo-500">🌀</span>
              <span className="text-[11px] font-bold text-gray-800 dark:text-slate-200 truncate">
                {a.label || a.email || "反重力账号"}
              </span>
            </div>
            {a.creditsKnown && (
              <span
                className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold shrink-0 ${
                  a.creditsAvailable
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                }`}
              >
                {a.creditsAvailable ? "Google One AI Pro" : "未启用"}
              </span>
            )}
          </div>

          {a.quotaSummary && a.quotaSummary.groups.length > 0 ? (
            <div className="space-y-2">
              {a.quotaSummary.groups.map((grp) => (
                <div key={grp.name}>
                  <p className="text-[10px] font-bold text-gray-700 dark:text-slate-200 mb-1">
                    {grp.shortName}
                  </p>
                  <div className="space-y-1.5">
                    {grp.windows.map((bar) => {
                      const pct =
                        bar.remainingFraction !== null
                          ? Math.round(Math.max(0, Math.min(1, bar.remainingFraction)) * 100)
                          : null;
                      return (
                        <div key={bar.key}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-medium text-gray-600 dark:text-slate-300 truncate">
                              {bar.label}
                            </span>
                            <span className="text-[10px] font-bold text-gray-700 dark:text-slate-200 shrink-0 ml-2">
                              {pct !== null ? `${pct}%` : "—"}
                            </span>
                          </div>
                          <div className="h-1 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500 transition-all"
                              style={{ width: pct !== null ? `${pct}%` : "0%" }}
                            />
                          </div>
                          {bar.resetTime && (
                            <p className="text-[9px] text-gray-400 dark:text-slate-500 mt-0.5">
                              {formatResetTime(bar.resetTime)}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-gray-400 dark:text-slate-500">
              {a.creditsKnown
                ? "暂无额度窗口数据"
                : a.quotaSummary?.status?.paidTierName || "订阅已启用"}
            </p>
          )}

          {a.lastError && (
            <p className="text-[9px] text-rose-400 truncate" title={a.lastError}>
              ⚠️ {a.lastError}
            </p>
          )}
        </div>
      ))}

      {codex.map((a) => (
        <div key={a.id} className="rounded-xl bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700 p-3 space-y-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm text-teal-500">🧠</span>
            <span className="text-[11px] font-bold text-gray-800 dark:text-slate-200 truncate">
              {a.label || a.email || "Codex 账号"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-gray-400 dark:text-slate-500">订阅方案</span>
            <span className="font-bold text-gray-700 dark:text-slate-200">{a.planType || "—"}</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-gray-400 dark:text-slate-500">可用状态</span>
            {a.codexUsage ? (
              a.codexUsage.allowed ? (
                <span className="font-bold text-[#00C776]">可用</span>
              ) : (
                <span className="font-bold text-rose-400">{codexLimitText(a.codexUsage)}</span>
              )
            ) : (
              <span className="font-bold text-gray-700 dark:text-slate-200">未查询</span>
            )}
          </div>
          {a.codexUsage?.primaryWindow && (
            <div>
              <div className="flex items-center justify-between text-[10px] mb-1">
                <span className="text-gray-400 dark:text-slate-500">
                  额度信息 · {codexWindowLabel(a.codexUsage.primaryWindow.windowSeconds)}
                </span>
                <span className="font-bold text-gray-700 dark:text-slate-200">
                  {codexRemainingText(a.codexUsage.primaryWindow)}
                </span>
              </div>
              <div className="h-1 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-teal-500 transition-all"
                  style={{ width: `${codexRemainingPct(a.codexUsage.primaryWindow)}%` }}
                />
              </div>
              {a.codexUsage.primaryWindow.resetAt && (
                <p className="text-[9px] text-gray-400 dark:text-slate-500 mt-0.5">
                  {formatResetTime(new Date(a.codexUsage.primaryWindow.resetAt * 1000).toISOString())}
                </p>
              )}
            </div>
          )}
          {a.lastError && (
            <p className="text-[9px] text-rose-400 truncate" title={a.lastError}>
              ⚠️ {a.lastError}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function codexWindowLabel(seconds: number | null): string {
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

function codexLimitText(usage: CodexUsage): string {
  const label = codexWindowLabel(usage.primaryWindow?.windowSeconds ?? null);
  if (label === "30D") return "月耗尽";
  if (label === "7D") return "周耗尽";
  return "已耗尽";
}

function codexRemainingPct(window: CodexUsageWindow): number {
  if (window.usedPercent === null) return 0;
  return Math.round(Math.max(0, Math.min(100, 100 - window.usedPercent)));
}

function codexRemainingText(window: CodexUsageWindow): string {
  return window.usedPercent === null ? "—" : `${codexRemainingPct(window)}%`;
}