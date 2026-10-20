"use client";

import { useTranslations } from "next-intl";
import LogoMark from "@/components/logo-mark";
import { useNavelixConfig } from "@/context/navelix-context";
import { fileToDataUrl } from "@/lib/image-utils";
import { DEFAULT_SITE_TITLE } from "@/lib/constants";
import type { LicenseStatus } from "@/lib/admin-pro";

/**
 * 「系统设置 → 系统功能」的卡片 1：🏷️ 全站品牌与 LOGO 自定义。
 *
 * 从 `admin-pro-tab.tsx`（原 1018 行）抽出 —— 该文件把商业授权、云存储备份、
 * 书签探针、品牌 LOGO 与代码注入五块设置塞在一起。本组件只渲染站点标题、
 * LOGO 文本与图标上传，三个字段直接读写 `useNavelixConfig()`；
 * 图标读取失败时提示「图片读取失败」（与原实现一致）。
 */
export default function AdminProBrandCard({
  licenseStatus,
  flash,
}: {
  licenseStatus: LicenseStatus;
  /** 仅展示 UI 提示（来自 useToast） */
  flash: (msg: string) => void;
}) {
  const tx = useTranslations();
  const { config, updateConfig } = useNavelixConfig();

  // ── Handler: Logo upload ──
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file, 128);
      updateConfig({ logoImage: dataUrl });
      flash(tx("logo_updated_successfully_a632e96e"));
    } catch {
      flash(tx("failed_to_read_image_ddc0de2f"));
    }
    e.target.value = "";
  };

  return (
    <div className="lg:col-span-6 bg-white dark:bg-slate-800/90 rounded-3xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <span>🏷️</span>
            <span>{tx("site_branding_logo_2be258a4")}</span>
          </h3>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            {tx("set_the_browser_tab_title_and_the_logo_text_or_i_83a1c0db")}</p>
        </div>
        {licenseStatus.isPro ? (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
            {tx("unlocked_b9d9fa83")}</span>
        ) : (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
            {tx("pro_feature_d54ea328")}</span>
        )}
      </div>

      <div className={`space-y-3.5 ${!licenseStatus.isPro ? "opacity-60 pointer-events-none" : ""}`}>
        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
            {tx("site_title_browser_tab_931e8987")}</label>
          <input
            type="text"
            disabled={!licenseStatus.isPro}
            value={config.siteTitle || ""}
            onChange={(e) => updateConfig({ siteTitle: e.target.value })}
            placeholder={DEFAULT_SITE_TITLE}
            className="w-full h-9 border border-gray-200 dark:border-slate-700 rounded-xl px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
            {tx("logo_text_1b5736a4")}</label>
          <input
            type="text"
            disabled={!licenseStatus.isPro}
            value={config.logoText}
            onChange={(e) => updateConfig({ logoText: e.target.value })}
            placeholder={tx("e_g_navelix_43dab975")}
            className="w-full h-9 border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-medium rounded-xl"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-slate-200 mb-1">
            {tx("upload_logo_46795fa3")}</label>
          <div className="flex items-center gap-3">
            <LogoMark size="md" />
            <input
              type="file"
              accept="image/*"
              disabled={!licenseStatus.isPro}
              onChange={handleLogoUpload}
              className="min-w-0 flex-1 text-xs text-gray-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:bg-[#00C776]/10 file:text-[#009a5a] file:text-xs file:font-semibold file:cursor-pointer cursor-pointer"
            />
            {config.logoImage && (
              <button
                type="button"
                disabled={!licenseStatus.isPro}
                onClick={() => updateConfig({ logoImage: "" })}
                className="shrink-0 text-xs text-rose-500 hover:text-rose-600 cursor-pointer"
              >
                {tx("clear_bce23772")}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
