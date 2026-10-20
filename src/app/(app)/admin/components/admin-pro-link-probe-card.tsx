"use client";

import { useTranslations } from "next-intl";
import { useNavelixConfig } from "@/context/navelix-context";
import type { LicenseStatus } from "@/lib/admin-pro";

/**
 * 「系统设置 → 系统功能」的卡片 4：🌐 书签实时网络延迟与存活探针。
 *
 * 从 `admin-pro-tab.tsx`（原 1018 行）抽出 —— 该文件把商业授权、云存储备份、
 * 书签探针、品牌 LOGO 与代码注入五块设置塞在一起。本组件只渲染探针开关，
 * 开关值直接读写 `useNavelixConfig()`，未激活时点击先弹授权提示（文案不变）。
 */
export default function AdminProLinkProbeCard({
  licenseStatus,
  onLockedClick,
}: {
  licenseStatus: LicenseStatus;
  /** 未激活时点击开关：打开授权弹窗并提示 Pro 专享 */
  onLockedClick: () => void;
}) {
  const tx = useTranslations();
  const { config, updateConfig } = useNavelixConfig();

  return (
    <div className="lg:col-span-6 bg-white dark:bg-slate-800/90 rounded-3xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <span>🌐</span>
            <span>{tx("live_bookmark_latency_availability_probes_1f441fce")}</span>
          </h3>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            {tx("measure_network_response_times_and_display_green_1c9eb674")}</p>
        </div>
        {licenseStatus.isPro ? (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
            {tx("activated_a7b32bb9")}</span>
        ) : (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
            {tx("pro_feature_6a38e2c7")}</span>
        )}
      </div>

      <div className="space-y-3">
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
                {tx("enable_live_bookmark_latency_and_availability_in_4139e778")}</p>
              <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
                {tx("show_live_response_times_on_bookmark_cards_e_g_2_ae2be407")}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!licenseStatus.isPro) {
                  onLockedClick();
                  return;
                }
                updateConfig({ linkStatusEnabled: !config.linkStatusEnabled });
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                licenseStatus.isPro && config.linkStatusEnabled
                  ? "bg-[#00C776] text-white"
                  : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
              }`}
            >
              {licenseStatus.isPro && config.linkStatusEnabled ? tx("on_8a4ef3e4") : tx("off_6744b4c6")}
            </button>
          </div>

          <div className="pt-2 border-t border-gray-200/60 dark:border-slate-800 flex items-center justify-between text-xs text-gray-600 dark:text-slate-400">
            <span>{tx("response_time_thresholds_c43d3533")}</span>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-emerald-600 dark:text-emerald-400">{tx("lt_350ms_fast_e0d59201")}</span>
              <span className="text-amber-500">🟡 350~1500ms</span>
              <span className="text-rose-500">{tx("timeout_offline_3f48c941")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
