"use client";

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
  return (
    <div className="bg-gradient-to-r from-emerald-50/80 via-white to-teal-50/60 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/90 rounded-3xl p-6 sm:p-7 border border-emerald-200/90 dark:border-emerald-500/30 shadow-sm dark:shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden transition-colors">
      <div className="flex items-start sm:items-center gap-4 z-10">
        <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#080B0F] border border-emerald-200/90 dark:border-emerald-500/30 p-2.5 flex items-center justify-center shrink-0 shadow-md ring-4 ring-emerald-500/15">
          <BrandLogo />
        </div>
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-wide">
              Pro 商业授权
            </h2>
            {licenseStatus.isPro ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 dark:bg-emerald-400/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-400/40 shadow-xs">
                ✨ 已激活 · {licensePlanLabel(licenseStatus.payload)}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
                未激活 Pro
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1.5">构建类型：{licenseStatus.isDockerBuild === undefined ? "读取中…" : licenseStatus.isDockerBuild ? "官方 Docker 镜像" : "源码构建"}</p>
          <p className="text-xs text-gray-600 dark:text-slate-300/85 mt-1.5 leading-relaxed max-w-2xl">
            {licenseStatus.isPro
              ? licenseSummaryLine(licenseStatus.payload)
              : "当前运行在免费开源模式。激活 Navelix Pro 许可证可解锁「S3 / WebDAV 异地容灾自动备份」、「书签卡片实时网络延迟与存活探针」、「全站品牌 LOGO 自定义」及「自定义 CSS / JS 探针注入」。"}
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
            注销授权
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenLicenseModal}
            className="w-full md:w-auto px-5 py-2.5 rounded-xl text-xs font-black bg-[#00C776] hover:bg-[#00B068] text-white transition-all cursor-pointer shadow-lg hover:scale-[1.02] flex items-center justify-center gap-2"
          >
            <span>💎</span>
            <span>立即输入激活码解锁 Pro</span>
          </button>
        )}
      </div>
    </div>
  );
}
