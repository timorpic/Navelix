"use client";

import type { UseAdminProfileAccountResult } from "@/hooks/use-admin-profile-account";

/**
 * 「个人账号与安全」Tab 的卡片 6：🔑 个人 API Access Token 密钥管理。
 *
 * 从 `admin-profile-tab.tsx`（原 1219 行）抽出 —— 生成 / 列表 / 撤销 /
 * 复制全部来自 `useAdminProfileAccount()`，本组件只负责渲染。
 */
export default function AdminProfileTokensCard({
  account,
}: {
  account: UseAdminProfileAccountResult;
}) {
  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <span>🔑</span>
          <span>个人 API Access Token</span>
        </h3>
        <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
          用于第三方快捷指令、自动化脚本或 Webhook 鉴权调用
        </p>
      </div>

      {/* 生成新 Token 表单 */}
      <form onSubmit={account.handleCreateToken} className="flex items-center gap-2">
        <input
          type="text"
          name="tokenName"
          value={account.newTokenNameInput}
          onChange={(e) => account.setNewTokenNameInput(e.target.value)}
          placeholder="密钥标识 (例如：iOS 快捷指令密钥)"
          className="flex-1 h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
        />
        <button
          type="submit"
          className="h-9 px-4 bg-[#00C776] hover:bg-[#009a5a] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
        >
          生成新密钥
        </button>
      </form>

      {/* 新创密钥提示框 */}
      {account.createdSecretToken && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs space-y-1.5">
          <p className="font-bold text-emerald-800 dark:text-emerald-300">
            🎉 新 API 密钥已生成（仅可复制一次）：
          </p>
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 font-mono text-[11px] text-emerald-700 dark:text-emerald-400 break-all select-all">
            <span>{account.createdSecretToken}</span>
            <button
              type="button"
              onClick={account.copyCreatedToken}
              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold shrink-0 cursor-pointer"
            >
              复制
            </button>
          </div>
        </div>
      )}

      {/* Token 列表 */}
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {account.loadingTokens ? (
          <p className="text-xs text-gray-400 py-4 text-center">加载 API 密钥中…</p>
        ) : account.apiTokens.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">暂未创建 API Token 密钥</p>
        ) : (
          account.apiTokens.map((t) => (
            <div
              key={t.id}
              className="p-3 rounded-xl bg-gray-50/50 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="font-bold text-gray-800 dark:text-slate-200 truncate">
                  {t.name}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-slate-400 font-mono truncate">
                  {t.tokenPrefix} · 创建于 {new Date(t.createdAt).toLocaleDateString("zh-CN")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => account.handleRevokeToken(t.id)}
                className="text-[11px] text-rose-500 hover:text-rose-700 font-semibold cursor-pointer shrink-0"
              >
                撤销
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
