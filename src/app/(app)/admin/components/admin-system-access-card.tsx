"use client";

import { useTranslations } from "next-intl";
import { useNavelixConfig } from "@/context/navelix-context";

/**
 * 「系统运维与安全」Tab 的块 1：🔒 访问控制与注册策略。
 *
 * 从 `admin-system-tab.tsx`（原 928 行）抽出 —— 两个开关直接读写
 * `useNavelixConfig()`，非管理员由父组件传入 `isAdmin` 决定禁用态
 * （提示与禁用样式均保持原样）。
 */
export default function AdminSystemAccessCard({ isAdmin }: { isAdmin: boolean }) {
  const tx = useTranslations();
  const { config, updateConfig } = useNavelixConfig();

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-4 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <span>🔒</span>
            <span>{tx("access_security_policies_5fb634b7")}</span>
          </h3>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            {tx("manage_public_access_and_registration_policies_5cfd9363")}</p>
        </div>
        {!isAdmin && (
          <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 text-amber-600 dark:text-amber-400">
            {tx("administrators_only_21a9d9f1")}</span>
        )}
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
          <div>
            <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
              {tx("allow_public_access_to_home_page_af0181e6")}</p>
            <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
              {config.allowPublicAccess
                ? tx("on_visitors_can_browse_your_home_page_without_si_3b2ea5c7")
                : tx("off_private_mode_visitors_are_redirected_to_sign_ae2ef3f8")}
            </p>
          </div>
          <button
            type="button"
            disabled={!isAdmin}
            title={isAdmin ? "" : tx("only_administrators_can_change_site_wide_access__1278d2d2")}
            onClick={() => {
              if (!isAdmin) return;
              updateConfig({
                allowPublicAccess: !config.allowPublicAccess,
                securitySetupDone: true,
              });
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              isAdmin ? "cursor-pointer" : "cursor-not-allowed opacity-80"
            } ${
              config.allowPublicAccess
                ? "bg-[#00C776] text-white"
                : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
            }`}
          >
            {config.allowPublicAccess ? tx("on_8a4ef3e4") : tx("private_mode_316f03ca")}
          </button>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700">
          <div>
            <p className="text-xs font-bold text-gray-800 dark:text-slate-200">
              {tx("allow_registration_daff6c83")}</p>
            <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
              {config.allowRegistration
                ? tx("on_anyone_can_create_an_account_at_register_16d34111")
                : tx("off_only_administrators_can_add_users_manually_d_ef8de1f4")}
            </p>
          </div>
          <button
            type="button"
            disabled={!isAdmin}
            title={isAdmin ? "" : tx("only_administrators_can_change_site_wide_access__1278d2d2")}
            onClick={() => {
              if (!isAdmin) return;
              updateConfig({
                allowRegistration: !config.allowRegistration,
                securitySetupDone: true,
              });
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              isAdmin ? "cursor-pointer" : "cursor-not-allowed opacity-80"
            } ${
              config.allowRegistration
                ? "bg-[#00C776] text-white"
                : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
            }`}
          >
            {config.allowRegistration ? tx("open_e2eceeca") : tx("off_6744b4c6")}
          </button>
        </div>
      </div>
    </div>
  );
}
