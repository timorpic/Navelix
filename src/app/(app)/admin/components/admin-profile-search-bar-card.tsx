"use client";

import { useTranslations } from "next-intl";
import { useNavelixConfig } from "@/context/navelix-context";

/**
 * 「个人账号与安全」Tab 的卡片：🔍 首页搜索栏。
 *
 * 这是**用户级**设置项（`showSearchBar` 属个人偏好、按 user_id 各存各的），
 * 原误放在「系统与数据管理」Tab。现移回个人设置区。
 * 单个开关直接读写 `useNavelixConfig()`，本身不持有 state。
 */
export default function AdminProfileSearchBarCard() {
  const tx = useTranslations();
  const { config, updateConfig } = useNavelixConfig();

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <span>🔍</span>
          <span>{tx("home_search_bar_4d897e72")}</span>
        </h3>
        <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
          {tx("search_only_within_your_workspace_bookmarks_sche_29c522e3")}</p>
      </div>
      <div className="space-y-3.5">
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
          <div>
            <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
              {tx("search_bar_visibility_e03847e4")}</p>
            <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
              {config.showSearchBar ? tx("current_status_search_bar_visible_686e6481") : tx("current_status_search_bar_hidden_79c2fbb6")}
            </p>
          </div>
          <button
            id="admin-searchbar-toggle"
            type="button"
            onClick={() => updateConfig({ showSearchBar: !config.showSearchBar })}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              config.showSearchBar ? "bg-brand text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
            }`}
          >
            {config.showSearchBar ? tx("hide_145219e7") : tx("show_4e1449e7")}
          </button>
        </div>
      </div>
    </div>
  );
}
