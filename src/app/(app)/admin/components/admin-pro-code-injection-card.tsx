"use client";

import { useNavelixConfig } from "@/context/navelix-context";
import type { LicenseStatus } from "@/lib/admin-pro";

/**
 * 「Pro 商业授权」Tab 的卡片 5：⚡ 自定义代码与统计探针注入。
 *
 * 从 `admin-pro-tab.tsx`（原 1018 行）抽出 —— 该文件把商业授权、云存储备份、
 * 书签探针、品牌 LOGO 与代码注入五块设置塞在一起。本组件只渲染两个
 * 代码文本框，内容直接读写 `useNavelixConfig()`。
 */
export default function AdminProCodeInjectionCard({
  licenseStatus,
}: {
  licenseStatus: LicenseStatus;
}) {
  const { config, updateConfig } = useNavelixConfig();

  return (
    <div className="lg:col-span-12 bg-white dark:bg-slate-800/90 rounded-3xl p-6 sm:p-7 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <span>⚡</span>
            <span>自定义代码与统计探针注入</span>
          </h3>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            支持接入 Umami / Google Analytics / 百度统计探针及自定义全局 CSS 样式
          </p>
        </div>
        {licenseStatus.isPro ? (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
            ✨ 已解锁
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
            🔒 PRO 功能
          </span>
        )}
      </div>

      <div className={`space-y-4 ${!licenseStatus.isPro ? "opacity-60 pointer-events-none" : ""}`}>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
            自定义 HTML / 统计脚本代码 (如 &lt;script&gt; 统计探针)
          </label>
          <textarea
            rows={3}
            disabled={!licenseStatus.isPro}
            value={config.customHeadScripts || ""}
            onChange={(e) => updateConfig({ customHeadScripts: e.target.value })}
            placeholder="<!-- 粘贴 Umami / Google Analytics / 百度统计等探针代码 -->&#10;<script defer src='https://analytics.example.com/script.js' data-website-id='...'></script>"
            className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-xs font-mono bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
            自定义全局 CSS 样式
          </label>
          <textarea
            rows={3}
            disabled={!licenseStatus.isPro}
            value={config.customCss || ""}
            onChange={(e) => updateConfig({ customCss: e.target.value })}
            placeholder="/* 输入你想要覆盖的自定义 CSS 样式 */&#10;body { font-family: sans-serif; }"
            className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-xs font-mono bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>
      </div>
    </div>
  );
}
