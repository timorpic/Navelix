"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useNavelixConfig, useNavelixData } from "@/context/navelix-context";

export default function SecuritySetupBanner() {
  const tx = useTranslations();
  const { user } = useNavelixData();
  const { config, updateConfig } = useNavelixConfig();

  // 仅对管理员展示；已完成安全设置引导或非管理员不展示
  if (!user || user.role !== "admin" || config.securitySetupDone) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 sm:p-5 shadow-2xs animate-fadeIn">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-2xl leading-none">🔐</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
              {tx("first_time_security_setup_7fe8d823")}</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700/90 dark:text-amber-300/80">
              {tx("public_access_and_self_registration_are_disabled_c6e3fe16")}</p>
            <ul className="mt-2 flex flex-col gap-1 text-xs text-amber-800 dark:text-amber-200/90">
              <li className="flex items-center gap-1.5">
                <span className="text-brand-strong">✓</span>
                <span>{tx("change_the_initial_password_in_account_security_83f3d3ec")}</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-brand-strong">✓</span>
                <span>{tx("enable_public_access_or_registration_in_system_s_0041ae1d")}</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href="/admin?tab=profile"
            className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-amber-600 cursor-pointer"
          >
            {tx("change_initial_password_bbd31e1f")}</Link>
          <Link
            href="/admin?tab=system"
            className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-brand-strong cursor-pointer"
          >
            {tx("configure_access_policies_f4073329")}</Link>
          <button
            type="button"
            onClick={() => updateConfig({ securitySetupDone: true })}
            className="rounded-xl border border-amber-300 dark:border-amber-800 px-4 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer"
          >
            {tx("got_it_d75b7323")}</button>
        </div>
      </div>
    </div>
  );
}
