"use client";

import type { UseAdminAntigravitySecretResult } from "@/hooks/use-admin-antigravity-secret";

/**
 * 「系统运维与安全」Tab 的块 3：🔐 反重力 OAuth 配置。
 *
 * 从 `admin-system-tab.tsx`（原 928 行）抽出 —— 密钥状态与保存逻辑来自
 * `useAdminAntigravitySecret()`；输入框保持非受控（defaultValue + key 重置），
 * 仅把值交给 `onBlur` 保存，与重构前逐字一致。
 */
export default function AdminSystemAntigravityCard({
  antigravity,
}: {
  antigravity: UseAdminAntigravitySecretResult;
}) {
  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <span>🔐</span>
          <span>反重力 OAuth 配置</span>
        </h3>
        <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
          模型账号监控面板授权反重力账号时使用的 Google OAuth 客户端密钥，保存在数据库中
        </p>
      </div>

      <div className="space-y-3.5">
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
          <div>
            <p className="text-xs font-bold text-gray-800 dark:text-slate-200">客户端密钥状态</p>
            <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
              {antigravity.isCustomAntigravitySecret
                ? "当前已配置自定义密钥（可重新输入覆盖）"
                : "当前使用内置官方默认密钥（开箱即用，无需配置；也可填入自定义密钥覆盖）"}
            </p>
          </div>
          <span className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            {antigravity.isCustomAntigravitySecret ? "已配置自定义" : "内置默认就绪"}
          </span>
        </div>

        <div>
          <label
            htmlFor="admin-antigravity-client-secret"
            className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1"
          >
            Google OAuth 客户端密钥
          </label>
          <input
            id="admin-antigravity-client-secret"
            type="password"
            defaultValue=""
            key={antigravity.isCustomAntigravitySecret ? "configured" : "empty"}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v) antigravity.saveAntigravitySecret(v);
            }}
            placeholder={antigravity.isCustomAntigravitySecret ? "已配置自定义密钥 - 粘贴新值可覆盖（留空保持不变）" : "粘贴 Client Secret（GOCSPX-…）"}
            autoComplete="off"
            className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-lg px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500"
          />
        </div>

        <div className="flex items-center gap-3">
          {antigravity.antigravityNotice && (
            <p className="text-xs font-medium text-teal-600 dark:text-teal-400">
              {antigravity.antigravityNotice}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
