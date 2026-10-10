"use client";

import { useNavelixConfig } from "@/context/navelix-context";

/**
 * 「系统运维与安全」Tab 的块 2：🔍 首页搜索栏。
 *
 * 从 `admin-system-tab.tsx`（原 928 行）抽出 —— 单个开关直接读写
 * `useNavelixConfig()`，本身不持有 state，是文件里耦合最少的一块。
 */
export default function AdminSystemSearchBarCard() {
  const { config, updateConfig } = useNavelixConfig();

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <span>🔍</span>
          <span>首页搜索栏</span>
        </h3>
        <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
          首页搜索仅限系统内（书签、日程、项目、消息），无需配置外部搜索引擎
        </p>
      </div>
      <div className="space-y-3.5">
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
          <div>
            <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
              搜索栏组件显示状态
            </p>
            <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
              {config.showSearchBar ? "当前状态：已显示搜索栏" : "当前状态：已隐藏搜索栏"}
            </p>
          </div>
          <button
            id="admin-searchbar-toggle"
            type="button"
            onClick={() => updateConfig({ showSearchBar: !config.showSearchBar })}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              config.showSearchBar ? "bg-[#00C776] text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
            }`}
          >
            {config.showSearchBar ? "隐藏" : "显示"}
          </button>
        </div>
      </div>
    </div>
  );
}
