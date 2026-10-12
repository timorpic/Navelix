"use client";

import { useTranslations } from "next-intl";
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
  const tx = useTranslations();
  const { config, updateConfig } = useNavelixConfig();

  return (
    <div className="lg:col-span-12 bg-white dark:bg-slate-800/90 rounded-3xl p-6 sm:p-7 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <span>⚡</span>
            <span>{tx("custom_code_analytics_scripts_fe93df55")}</span>
          </h3>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            {tx("add_umami_google_analytics_baidu_analytics_or_cu_030aa763")}</p>
        </div>
        {licenseStatus.isPro ? (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
            {tx("unlocked_b9d9fa83")}</span>
        ) : (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
            {tx("pro_feature_d54ea328")}</span>
        )}
      </div>

      <div className={`space-y-4 ${!licenseStatus.isPro ? "opacity-60 pointer-events-none" : ""}`}>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
            {tx("custom_html_analytics_scripts_e_g_lt_script_gt_bcda0347")}</label>
          <textarea
            rows={3}
            disabled={!licenseStatus.isPro}
            value={config.customHeadScripts || ""}
            onChange={(e) => updateConfig({ customHeadScripts: e.target.value })}
            placeholder={tx("paste_your_analytics_script_here_10_script_defer_87a660da")}
            className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-xs font-mono bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
            {tx("custom_global_css_99ecc1e8")}</label>
          <textarea
            rows={3}
            disabled={!licenseStatus.isPro}
            value={config.customCss || ""}
            onChange={(e) => updateConfig({ customCss: e.target.value })}
            placeholder={tx("enter_your_custom_css_overrides_10_body_font_fam_248439bc")}
            className="w-full border border-gray-200 dark:border-slate-700 rounded-xl p-3 text-xs font-mono bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>
      </div>
    </div>
  );
}
