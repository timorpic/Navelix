"use client";

import { useNavelixConfig } from "@/context/navelix-context";
import type { LicenseStatus } from "@/lib/admin-pro";

/**
 * 「Pro 商业授权」Tab 的卡片 3：🌐 书签实时网络延迟与存活探针。
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
  const { config, updateConfig } = useNavelixConfig();

  return (
    <div className="lg:col-span-6 bg-white dark:bg-slate-800/90 rounded-3xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <span>🌐</span>
            <span>书签实时网络延迟与健康存活探针</span>
          </h3>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            实时测量卡片网络响应延迟并以绿/黄/红状态灯展示
          </p>
        </div>
        {licenseStatus.isPro ? (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
            ✨ 已激活
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0">
            🔒 PRO 特权
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
                开启书签实时网络延迟与健康状态灯
              </p>
              <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
                在前台书签卡片右上角显示实时网络响应速度（如 🟢 24ms / 🟡 450ms / 🔴 离线）
              </p>
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
              {licenseStatus.isPro && config.linkStatusEnabled ? "已开启" : "已关闭"}
            </button>
          </div>

          <div className="pt-2 border-t border-gray-200/60 dark:border-slate-800 flex items-center justify-between text-xs text-gray-600 dark:text-slate-400">
            <span>探测响应分级基准：</span>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-emerald-600 dark:text-emerald-400">🟢 &lt;350ms (极速)</span>
              <span className="text-amber-500">🟡 350~1500ms</span>
              <span className="text-rose-500">🔴 超时/离线</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
