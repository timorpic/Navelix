"use client";

import React, { useRef } from "react";
import type { UseAdminDataTransferResult } from "@/hooks/use-admin-data-transfer";

/**
 * 「系统运维与安全」Tab 的块 6：📦 配置与数据导入导出。
 *
 * 从 `admin-system-tab.tsx`（原 928 行）抽出 —— 全量 JSON 导出/导入与
 * Sun-Panel、HTML 书签两种兼容导入的接口调用与提示来自
 * `useAdminDataTransfer()`；本组件只保留四个入口与三个隐藏 input，
 * 导入结束后把 input 交给 `resetFileInput()` 清空。
 */
export default function AdminSystemDataTransferCard({
  transfer,
}: {
  transfer: UseAdminDataTransferResult;
}) {
  const navelixFileRef = useRef<HTMLInputElement>(null);
  const bookmarkFileRef = useRef<HTMLInputElement>(null);
  const sunPanelFileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <span>📦</span>
          <span>配置与数据导入导出</span>
        </h3>
        <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
          支持一键导出 Navelix 全量配置，或从 Sun-Panel / Chrome HTML 书签导入数据
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Card 1: Sun-Panel JSON 兼容导入 */}
        <div className="bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl p-4 border border-teal-100 dark:border-teal-900/60 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-base">☀️</span>
            <h4 className="text-xs font-bold text-gray-900 dark:text-white">
              导入 Sun-Panel 配置文件
            </h4>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-400 leading-relaxed">
            无缝兼容 Sun-Panel 导出的 JSON 配置文件，自动解析分类与网址并合并。
          </p>
          <input
            ref={sunPanelFileRef}
            type="file"
            name="sun-panel-file"
            accept=".json,application/json"
            aria-label="选择 Sun-Panel JSON 文件"
            className="hidden"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              if (!file) return;
              transfer.importSunPanel(file, e.target);
            }}
          />
          <button
            onClick={() => sunPanelFileRef.current?.click()}
            className="w-full py-1.5 bg-[#00C776] hover:bg-[#009a5a] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>☀️</span>
            <span>选择 JSON 文件</span>
          </button>
        </div>

        {/* Card 2: Chrome / 浏览器 HTML 书签导入 */}
        <div className="bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="text-base">🌐</span>
            <h4 className="text-xs font-bold text-gray-900 dark:text-white">
              导入 Chrome / HTML 书签
            </h4>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-slate-400 leading-relaxed">
            解析 Chrome、Edge 或 Safari 导出的 HTML 书签文件并智能归类。
          </p>
          <input
            ref={bookmarkFileRef}
            type="file"
            name="bookmark-file"
            accept=".html,text/html"
            aria-label="选择 HTML 书签文件"
            className="hidden"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              if (!file) return;
              transfer.importBookmarks(file, e.target);
            }}
          />
          <button
            onClick={() => bookmarkFileRef.current?.click()}
            className="w-full py-1.5 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-600 dark:text-sky-400 text-xs font-semibold rounded-xl border border-sky-200 dark:border-sky-900 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>🌐</span>
            <span>选择 HTML 文件</span>
          </button>
        </div>

        {/* Card 3: 导出全量 Navelix JSON */}
        <div className="bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 space-y-2.5">
          <h4 className="text-xs font-bold text-gray-900 dark:text-white">导出全量配置 JSON</h4>
          <p className="text-[11px] text-gray-400 dark:text-slate-400 leading-relaxed">
            导出包含全量书签、分组与个性化外观在内的 Navelix JSON 文件。
          </p>
          <button
            onClick={transfer.exportAllData}
            className="w-full py-1.5 bg-gray-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            导出 Navelix JSON
          </button>
        </div>

        {/* Card 4: 导入全量 Navelix JSON */}
        <div className="bg-gray-50/50 dark:bg-slate-900/40 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 space-y-2.5">
          <h4 className="text-xs font-bold text-gray-900 dark:text-white">导入全量 Navelix JSON</h4>
          <p className="text-[11px] text-gray-400 dark:text-slate-400 leading-relaxed">
            选择 Navelix 导出的 JSON 文件一键还原书签与外观配置。
          </p>
          <input
            ref={navelixFileRef}
            type="file"
            name="navelix-config-file"
            accept=".json,application/json"
            aria-label="选择 Navelix JSON 文件"
            className="hidden"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              if (!file) return;
              transfer.importAllData(file, e.target);
            }}
          />
          <button
            onClick={() => navelixFileRef.current?.click()}
            className="w-full py-1.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            选择 Navelix JSON
          </button>
        </div>
      </div>
    </div>
  );
}
