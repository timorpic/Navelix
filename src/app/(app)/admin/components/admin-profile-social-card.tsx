"use client";

import { useNavelixConfig } from "@/context/navelix-context";

/**
 * 「个人账号与安全」Tab 的卡片 2：🌐 个人社交媒体与外部主页。
 *
 * 从 `admin-profile-tab.tsx`（原 1219 行）抽出 —— 四个输入框直接读写
 * `useNavelixConfig()` 的社交链接字段，本身不持有 state，是文件里
 * 耦合最少的一块。
 */
export default function AdminProfileSocialCard() {
  const { config, updateConfig } = useNavelixConfig();

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <span>🌐</span>
          <span>个人社交与外部主页链接</span>
        </h3>
        <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
          配置您的 GitHub / X / LinkedIn 主页链接，实时呈现在前台底部
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="admin-social-github-profile" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
            GitHub 主页
          </label>
          <input
            id="admin-social-github-profile"
            type="text"
            value={config.socialGithub || ""}
            onChange={(e) => updateConfig({ socialGithub: e.target.value })}
            placeholder="https://github.com/username"
            className="w-full h-8.5 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
          />
        </div>

        <div>
          <label htmlFor="admin-social-x-profile" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
            X (Twitter)
          </label>
          <input
            id="admin-social-x-profile"
            type="text"
            value={config.socialX || ""}
            onChange={(e) => updateConfig({ socialX: e.target.value })}
            placeholder="https://x.com/username"
            className="w-full h-8.5 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
          />
        </div>

        <div>
          <label htmlFor="admin-social-linkedin-profile" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
            LinkedIn 领英
          </label>
          <input
            id="admin-social-linkedin-profile"
            type="text"
            value={config.socialLinkedin || ""}
            onChange={(e) => updateConfig({ socialLinkedin: e.target.value })}
            placeholder="https://linkedin.com/in/username"
            className="w-full h-8.5 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
          />
        </div>

        <div>
          <label htmlFor="admin-social-email-profile" className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
            公开联系邮箱
          </label>
          <input
            id="admin-social-email-profile"
            type="text"
            value={config.socialEmail || ""}
            onChange={(e) => updateConfig({ socialEmail: e.target.value })}
            placeholder="mailto:you@example.com"
            className="w-full h-8.5 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono"
          />
        </div>
      </div>
    </div>
  );
}
