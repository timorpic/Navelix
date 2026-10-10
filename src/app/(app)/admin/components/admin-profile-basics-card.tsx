"use client";

import { resolveAvatar } from "@/lib/avatars";
import { profileNoticeColor } from "@/lib/admin-profile";
import type { UseAdminProfileAccountResult } from "@/hooks/use-admin-profile-account";

/**
 * 「个人账号与安全」Tab 的卡片 1：👤 基础资料 & 名片。
 *
 * 从 `admin-profile-tab.tsx`（原 1219 行）抽出 —— 该文件把 6 张互不相关的
 * 设置卡片与 31 个 useState 塞在一起。本组件只渲染头像名片与三个失焦即存的
 * 资料输入框，状态与保存逻辑全部来自 `useAdminProfileAccount()`。
 */
export default function AdminProfileBasicsCard({
  account,
}: {
  account: UseAdminProfileAccountResult;
}) {
  const { currentUser } = account;

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-5 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700/80">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="relative group cursor-pointer shrink-0"
            onClick={account.openAvatarModal}
            title="点击修改头像"
          >
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#3B82F6] via-[#00C776] to-[#8B5CF6] flex items-center justify-center text-white text-xl font-bold shadow-md overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveAvatar(currentUser?.avatar, currentUser?.username)}
                alt={currentUser?.displayName || "User"}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity">
              修改
            </div>
          </div>

          <div className="space-y-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
              {currentUser?.displayName || currentUser?.username || "Admin"}
            </h3>
            <p className="text-xs text-gray-400 font-mono">
              账号: @{currentUser?.username || "admin"}
            </p>
            <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-900">
              {currentUser?.role === "admin" ? "👑 超级系统管理员" : "👤 普通注册用户"}
            </div>
          </div>
        </div>

        {/* 快捷按钮 */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={account.openAvatarModal}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
          >
            <span>🖼️</span>
            <span>头像</span>
          </button>

          <button
            type="button"
            onClick={account.openChangePasswordModal}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 border border-gray-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
          >
            <span>🔐</span>
            <span>密码</span>
          </button>
        </div>
      </div>

      {/* 修改基本资料表单（失焦即保存） */}
      <div className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="admin-profile-display-name" className="block text-xs font-bold text-gray-700 dark:text-slate-200">
            显示名称 (昵称)
          </label>
          <input
            id="admin-profile-display-name"
            name="displayName"
            type="text"
            value={account.profileDisplayNameInput}
            onChange={(e) => account.setProfileDisplayNameInput(e.target.value)}
            onBlur={() => account.saveProfile({ displayName: account.profileDisplayNameInput })}
            placeholder="例如 亚历克斯"
            className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="admin-profile-email" className="block text-xs font-bold text-gray-700 dark:text-slate-200">
            个人邮箱地址
          </label>
          <input
            id="admin-profile-email"
            name="email"
            type="email"
            value={account.profileEmailInput}
            onChange={(e) => account.setProfileEmailInput(e.target.value)}
            onBlur={() => account.saveProfile({ email: account.profileEmailInput })}
            placeholder="you@example.com"
            className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="admin-profile-bio" className="block text-xs font-bold text-gray-700 dark:text-slate-200">
            个人座右铭 / 签名
          </label>
          <input
            id="admin-profile-bio"
            name="bio"
            type="text"
            value={account.profileBioInput}
            onChange={(e) => account.setProfileBioInput(e.target.value)}
            onBlur={() => account.saveProfile({ bio: account.profileBioInput })}
            placeholder="例如：极客致远 · 构建与探索"
            className="w-full h-9 rounded-xl border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          />
          <p className="text-[10px] text-gray-400 dark:text-slate-400">
            个性签名将同步展示在侧边栏底部名片卡片上
          </p>
        </div>

        {account.profilePasswordNotice && (
          <p className="text-xs font-semibold pt-1" style={{ color: profileNoticeColor(account.profilePasswordNotice) }}>
            {account.profilePasswordNotice}
          </p>
        )}
      </div>
    </div>
  );
}
