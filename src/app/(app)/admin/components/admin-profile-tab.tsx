"use client";

import Toast from "@/components/toast";
import { useNavelixConfig } from "@/context/navelix-context";
import { useToast } from "@/hooks/use-toast";
import { useAdminProfileAccount } from "@/hooks/use-admin-profile-account";
import { useAdminTelegramSettings } from "@/hooks/use-admin-telegram-settings";
import { useAdminReportSettings } from "@/hooks/use-admin-report-settings";
import AdminProfileBasicsCard from "./admin-profile-basics-card";
import AdminProfileSocialCard from "./admin-profile-social-card";
import AdminProfileAiCard from "./admin-profile-ai-card";
import AdminProfileSessionsCard from "./admin-profile-sessions-card";
import AdminProfileTokensCard from "./admin-profile-tokens-card";
import AdminProfileTelegramCard from "./admin-profile-telegram-card";
import AdminProfileReportCard from "./admin-profile-report-card";
import AdminProfileAvatarModal from "./admin-profile-avatar-modal";
import AdminProfilePasswordModal from "./admin-profile-password-modal";

/**
 * 管理后台「个人账号与安全」Tab 的组装层。
 *
 * 原文件 1219 行、31 个 useState，把账号安全（资料 / 改密 / 设备会话 /
 * API Token）、Telegram 通知、AI Copilot 与匿名遥测四块互不相关的设置
 * 挤在一个组件里。现按功能域拆分：
 *   - 状态与副作用 → `useAdminProfileAccount` / `useAdminTelegramSettings` / `useAdminReportSettings`
 *   - 纯逻辑（校验、响应解析、设备名映射）→ `@/lib/admin-profile`
 *   - 各设置卡片 → 同目录 `admin-profile-*-card.tsx`，两个弹窗 → `admin-profile-*-modal.tsx`
 * 本文件只保留标题区、两栏栅格与卡片编排。
 */
export default function AdminProfileTab() {
  const { updateConfig } = useNavelixConfig();

  // Flash / notify helpers
  const { notice, flash, notify } = useToast();

  // 三块设置各自的状态与接口调用
  const account = useAdminProfileAccount({ flash, notify, updateConfig });
  const tg = useAdminTelegramSettings({ flash });
  const report = useAdminReportSettings({ flash });

  return (
    <>
      <Toast message={notice} className="mb-4" />

      <div className="max-w-full space-y-6">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span>个人账号与安全</span>
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            管理您的个人基本资料、AI Copilot、社交网络主页、活跃设备会话与 API Access Token
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* 左栏：基础资料 & 社交链接 */}
          <div className="space-y-6">
            {/* 卡片 1：👤 基础资料 & 名片 */}
            <AdminProfileBasicsCard account={account} />

            {/* 卡片 2：🌐 个人社交媒体与外部主页 */}
            <AdminProfileSocialCard />

            {/* 卡片 3：🤖 AI Copilot */}
            <AdminProfileAiCard notify={notify} />
          </div>

          {/* 右栏：登录安全与活跃会话 & API Token 管理 */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 卡片 3：🛡️ 已登录设备管理 */}
              <AdminProfileSessionsCard account={account} />

              {/* 卡片 5：📮 Telegram 通知配置 */}
              <AdminProfileTelegramCard tg={tg} />
            </div>

            {/* 卡片 4：🔑 个人 API Token 密钥管理 */}
            <AdminProfileTokensCard account={account} />

            {/* 卡片 6：📡 匿名遥测（隐私透明开关，仅管理员可见） */}
            {account.currentUser?.role === "admin" && (
              <AdminProfileReportCard report={report} />
            )}
          </div>
        </div>
      </div>

      {/* Avatar Picker Modal */}
      <AdminProfileAvatarModal account={account} />

      {/* Dedicated Change Password Modal */}
      <AdminProfilePasswordModal account={account} />
    </>
  );
}
