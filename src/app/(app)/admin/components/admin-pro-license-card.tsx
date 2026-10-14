"use client";

import { useText } from "@/hooks/use-text";
import { useTranslations, useLocale } from "next-intl";
import BrandLogo from "@/components/brand-logo";
import {
  licensePlanLabel,
  licenseSummaryLine,
  type LicenseStatus,
} from "@/lib/admin-pro";

/**
 * 「Pro 商业授权」Tab 的卡片 1：💎 商业授权与 License 激活中心。
 *
 * 从 `admin-pro-tab.tsx`（原 1018 行）抽出 —— 该文件把商业授权、云存储备份、
 * 书签探针、品牌 LOGO 与代码注入五块设置塞在一起。本组件只负责渲染授权
 * 横幅与状态徽标；标题、徽标分支、计划名与授权信息行的判定在
 * `@/lib/admin-pro`，状态与接口调用在 `useAdminLicense()`。
 */
export default function AdminProLicenseCard({
  licenseStatus,
  onRemoveLicense,
  onOpenLicenseModal,
}: {
  licenseStatus: LicenseStatus;
  onRemoveLicense: () => void;
  onOpenLicenseModal: () => void;
}) {
  const text = useText();
  const tx = useTranslations();
  const locale = useLocale();
  return (
    <div className="bg-gradient-to-r from-emerald-50/80 via-white to-teal-50/60 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/90 rounded-3xl p-6 sm:p-7 border border-emerald-200/90 dark:border-emerald-500/30 shadow-sm dark:shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden transition-colors">
      <div className="flex items-start sm:items-center gap-4 z-10">
        <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#080B0F] border border-emerald-200/90 dark:border-emerald-500/30 p-2.5 flex items-center justify-center shrink-0 shadow-md ring-4 ring-emerald-500/15">
          <BrandLogo />
        </div>
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-wide">
              {tx("pro_license_299265b7")}</h2>
            {licenseStatus.isPro ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 dark:bg-emerald-400/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-400/40 shadow-xs">
                {tx("activated_9f512be5")}{text(licensePlanLabel(licenseStatus.payload))}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
                {tx("pro_not_activated_8277dabf")}</span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1.5">{tx("build_type_1a0651d6")}{licenseStatus.isDockerBuild === undefined ? tx("loading_346ff60e") : licenseStatus.isDockerBuild ? tx("official_docker_image_031ab013") : tx("source_build_1b6330ce")}</p>
          <p className="text-xs text-gray-600 dark:text-slate-300/85 mt-1.5 leading-relaxed max-w-2xl">
            {licenseStatus.isPro
              ? text(licenseSummaryLine(licenseStatus.payload, locale))
              : tx("you_are_running_the_free_community_edition_activ_03c2d43b")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 z-10 w-full md:w-auto">
        {licenseStatus.isPro ? (
          <button
            type="button"
            onClick={onRemoveLicense}
            className="w-full md:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-white/10 dark:hover:bg-white/20 dark:text-slate-200 border border-gray-200 dark:border-white/15 transition-all cursor-pointer"
          >
            {tx("deactivate_license_e56a59e9")}</button>
        ) : (
          <button
            type="button"
            onClick={onOpenLicenseModal}
            className="w-full md:w-auto px-5 py-2.5 rounded-xl text-xs font-black bg-brand hover:bg-brand-hover text-white transition-all cursor-pointer shadow-lg hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            <span>💎</span>
            <span>{tx("enter_a_license_key_to_unlock_pro_7731402a")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
