"use client";

import type { UseAdminCachePurgeResult } from "@/hooks/use-admin-cache-purge";

/**
 * 「系统运维与安全」Tab 的块 7：🧹 缓存与系统存储清理。
 *
 * 从 `admin-system-tab.tsx`（原 928 行）抽出 —— 三个清理按钮的执行逻辑与
 * 内联提示来自 `useAdminCachePurge()`，本组件只负责渲染按钮与提示。
 */
export default function AdminSystemCachePurgeCard({
  purge,
}: {
  purge: UseAdminCachePurgeResult;
}) {
  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <span>🧹</span>
          <span>系统存储与缓存运维</span>
        </h3>
        <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
          一键清空过期的历史操作通知，执行 SQLite 数据库碎片整理与深度优化
        </p>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          disabled={purge.isPurgingCache}
          onClick={() => purge.purgeCache("notifications")}
          className="px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
        >
          清空 7 天前已读操作日志
        </button>
        <button
          type="button"
          disabled={purge.isPurgingCache}
          onClick={() => purge.purgeCache("vacuum")}
          className="px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
        >
          数据库 VACUUM 碎片整理
        </button>
        <button
          type="button"
          disabled={purge.isPurgingCache}
          onClick={() => purge.purgeCache("all")}
          className="px-3.5 py-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
        >
          一键全量深度优化
        </button>
      </div>

      {purge.purgeNotice && (
        <p className="text-xs font-medium text-teal-600 dark:text-teal-400 animate-fadeIn">
          {purge.purgeNotice}
        </p>
      )}
    </div>
  );
}
