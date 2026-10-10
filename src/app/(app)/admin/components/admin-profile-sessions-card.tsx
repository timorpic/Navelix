"use client";

import { sessionLabel } from "@/lib/admin-profile";
import type { UseAdminProfileAccountResult } from "@/hooks/use-admin-profile-account";

/**
 * 「个人账号与安全」Tab 的卡片 4：🛡️ 已登录设备管理。
 *
 * 从 `admin-profile-tab.tsx`（原 1219 行）抽出 —— 会话列表与踢出操作
 * 全部来自 `useAdminProfileAccount()`，本组件只负责渲染。
 */
export default function AdminProfileSessionsCard({
  account,
}: {
  account: UseAdminProfileAccountResult;
}) {
  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <span>🛡️</span>
            <span>已登录设备</span>
          </h3>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            实时监控所有登录本账号的设备会话与 IP
          </p>
        </div>

        <button
          type="button"
          onClick={account.handleRevokeOtherSessions}
          className="px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer shrink-0"
        >
          踢出其他设备
        </button>
      </div>

      <div className="space-y-2.5 max-h-64 overflow-y-auto">
        {account.loadingSessions ? (
          <p className="text-xs text-gray-400 py-4 text-center">加载设备会话中…</p>
        ) : account.activeSessions.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">暂无活动会话</p>
        ) : (
          account.activeSessions.map((s) => (
            <div
              key={s.tokenHash}
              className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                s.isCurrent
                  ? "bg-teal-50/50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900/80"
                  : "bg-gray-50/50 dark:bg-slate-900/40 border-gray-100 dark:border-slate-700/60"
              }`}
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-800 dark:text-slate-200 truncate">
                    {sessionLabel(s.userAgent)}
                  </span>
                  {s.isCurrent && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#00C776] text-white">
                      当前设备
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 dark:text-slate-400 font-mono truncate">
                  IP: {s.ipAddress} · 活跃于 {new Date(s.lastActiveAt).toLocaleString("zh-CN")}
                </p>
              </div>

              {!s.isCurrent && (
                <button
                  type="button"
                  onClick={() => account.handleRevokeSession(s.tokenHash)}
                  className="text-[11px] text-red-500 hover:text-red-700 font-semibold cursor-pointer shrink-0"
                >
                  强退
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
