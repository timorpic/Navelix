"use client";

import { useNavelixConfig } from "@/context/navelix-context";

/**
 * 「系统运维与安全」Tab 的块 1：🔒 访问控制与注册策略。
 *
 * 从 `admin-system-tab.tsx`（原 928 行）抽出 —— 两个开关直接读写
 * `useNavelixConfig()`，非管理员由父组件传入 `isAdmin` 决定禁用态
 * （提示与禁用样式均保持原样）。
 */
export default function AdminSystemAccessCard({ isAdmin }: { isAdmin: boolean }) {
  const { config, updateConfig } = useNavelixConfig();

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <span>🔒</span>
            <span>访问与安全策略控制</span>
          </h3>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            管理未登录访客公开访问权限与新用户开放注册策略
          </p>
        </div>
        {!isAdmin && (
          <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 text-amber-600 dark:text-amber-400">
            🔒 仅管理员可修改
          </span>
        )}
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
          <div>
            <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
              未登录访客公开访问主页
            </p>
            <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
              {config.allowPublicAccess
                ? "开启：访客无需登录即可浏览导航主页（适合个人公开主页）"
                : "关闭（私有模式）：未登录者访问首页将直接强制跳转登录页（系统默认）"}
            </p>
          </div>
          <button
            type="button"
            disabled={!isAdmin}
            title={isAdmin ? "" : "仅管理员有权修改全站安全与访问策略（当前显示已同步的全局状态）"}
            onClick={() => {
              if (!isAdmin) return;
              updateConfig({
                allowPublicAccess: !config.allowPublicAccess,
                securitySetupDone: true,
              });
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              isAdmin ? "cursor-pointer" : "cursor-not-allowed opacity-80"
            } ${
              config.allowPublicAccess
                ? "bg-[#00C776] text-white"
                : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
            }`}
          >
            {config.allowPublicAccess ? "已开启" : "私有模式"}
          </button>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
          <div>
            <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
              开放新用户注册
            </p>
            <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
              {config.allowRegistration
                ? "开启：任何人均可通过 /register 页面注册新账号"
                : "关闭：禁止公网用户自主注册，仅管理员可在后台手动添加用户（系统默认）"}
            </p>
          </div>
          <button
            type="button"
            disabled={!isAdmin}
            title={isAdmin ? "" : "仅管理员有权修改全站安全与访问策略（当前显示已同步的全局状态）"}
            onClick={() => {
              if (!isAdmin) return;
              updateConfig({
                allowRegistration: !config.allowRegistration,
                securitySetupDone: true,
              });
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              isAdmin ? "cursor-pointer" : "cursor-not-allowed opacity-80"
            } ${
              config.allowRegistration
                ? "bg-[#00C776] text-white"
                : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
            }`}
          >
            {config.allowRegistration ? "已开放" : "已关闭"}
          </button>
        </div>
      </div>
    </div>
  );
}
