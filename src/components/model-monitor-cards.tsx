"use client";

import type {
  CodexUsageWindow,
  MonitorAccount,
} from "./model-monitor-types";
import { PROVIDER_META } from "./model-monitor-types";
import { codexLimitText, codexWindowLabel, formatRelative, formatResetTime } from "./model-monitor-utils";

function QuotaBar({
  label,
  remainingFraction,
  resetTime,
}: {
  label: string;
  remainingFraction: number | null;
  resetTime: string;
}) {
  const pct =
    remainingFraction !== null
      ? Math.round(Math.max(0, Math.min(1, remainingFraction)) * 100)
      : null;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-gray-600 dark:text-slate-300 truncate">{label}</span>
        <span className="text-[11px] font-bold text-gray-700 dark:text-slate-200 shrink-0 ml-2">
          {pct !== null ? `${pct}%` : "—"}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-teal-400 transition-all"
          style={{ width: pct !== null ? `${pct}%` : "0%" }}
        />
      </div>
      {resetTime && (
        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
          {formatResetTime(resetTime)}
        </p>
      )}
    </div>
  );
}

function CodexUsageBar({ window: w }: { window: CodexUsageWindow }) {
  const used =
    w.usedPercent !== null
      ? Math.round(Math.max(0, Math.min(100, w.usedPercent)))
      : null;
  const remaining = used !== null ? 100 - used : null;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-gray-600 dark:text-slate-300 truncate">
          {codexWindowLabel(w.windowSeconds)}
        </span>
        <span className="text-[11px] font-bold text-gray-700 dark:text-slate-200 shrink-0 ml-2">
          {remaining !== null ? `${remaining}%` : "—"}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-teal-400 transition-all"
          style={{ width: remaining !== null ? `${remaining}%` : "0%" }}
        />
      </div>
      {w.resetAt && (
        <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
          {formatResetTime(new Date(w.resetAt * 1000).toISOString())}
        </p>
      )}
    </div>
  );
}

export function AccountCard({
  account,
  refreshing,
  onRefresh,
  onDisconnect,
}: {
  account: MonitorAccount;
  refreshing: boolean;
  onRefresh: () => void;
  onDisconnect: () => void;
}) {
  const meta = PROVIDER_META[account.provider];

  return (
    <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-base ${meta.color}`}>{meta.icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
              {account.label}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-slate-400 truncate">
              {account.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="text-gray-400 hover:text-[#00C776] disabled:opacity-40 transition-colors cursor-pointer text-sm"
            title="刷新额度"
          >
            {refreshing ? "⏳" : "🔄"}
          </button>
          <button
            onClick={onDisconnect}
            className="text-gray-400 hover:text-rose-500 transition-colors cursor-pointer text-sm"
            title="断开账号"
          >
            🔌
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        {account.provider === "antigravity" ? (
          <>
            <div className="col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-400 dark:text-slate-400">订阅状态</p>
                {account.creditsKnown && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                      account.creditsAvailable
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                    }`}
                  >
                    {account.creditsAvailable ? "已启用" : "未启用"}
                  </span>
                )}
              </div>
              <p className={`text-sm font-bold mt-0.5 ${account.creditsAvailable ? "text-[#00C776]" : "text-gray-900 dark:text-white"}`}>
                {account.quotaSummary?.status?.paidTierName ||
                  account.quotaSummary?.status?.currentTierId ||
                  (account.creditsKnown ? "Gemini Code Assist" : "未查询")}
              </p>
              {account.quotaSummary?.status?.paidTierId && (
                <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">
                  档位 ID：{account.quotaSummary.status.paidTierId}
                </p>
              )}
            </div>

            <div className="col-span-2">
              <p className="text-[10px] text-gray-400 dark:text-slate-400 mb-1.5">调用额度</p>
              {account.quotaSummary && account.quotaSummary.groups.length > 0 ? (
                <div className="space-y-2">
                  {account.quotaSummary.groups.map((grp) => (
                    <div key={grp.name}>
                      <p className="text-[11px] font-bold text-gray-700 dark:text-slate-200 mb-1">
                        {grp.shortName}
                      </p>
                      <div className="space-y-1.5">
                        {grp.windows.map((bar) => (
                          <QuotaBar
                            key={bar.key}
                            label={bar.label}
                            remainingFraction={bar.remainingFraction}
                            resetTime={bar.resetTime}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  暂无额度窗口数据{account.projectId ? "" : "（未取得项目 ID）"}
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-[10px] text-gray-400 dark:text-slate-400">订阅方案</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {account.planType || "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-gray-400 dark:text-slate-400">可用状态</p>
              {account.codexUsage ? (
                account.codexUsage.allowed ? (
                  <p className="text-sm font-bold text-[#00C776]">可用</p>
                ) : (
                  <p className="text-sm font-bold text-rose-500">
                    {codexLimitText(account.codexUsage)}
                  </p>
                )
              ) : (
                <p className="text-sm font-bold text-gray-900 dark:text-white">未查询</p>
              )}
            </div>
            <div className="col-span-2">
              <p className="text-[10px] text-gray-400 dark:text-slate-400 mb-1.5">额度信息</p>
              {account.codexUsage?.primaryWindow ? (
                <CodexUsageBar window={account.codexUsage.primaryWindow} />
              ) : (
                <p className="text-xs text-gray-400 dark:text-slate-500">暂无额度数据</p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400 dark:text-slate-500">
        <span>上次刷新：{formatRelative(account.lastCheckedAt)}</span>
        {account.lastError && (
          <span className="text-rose-400 truncate max-w-[180px]" title={account.lastError}>
            ⚠️ {account.lastError}
          </span>
        )}
      </div>
    </div>
  );
}