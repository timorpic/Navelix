"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  formatUpdateTime,
  versionLabel,
} from "@/lib/admin-system";
import type { UseAdminUpdateCheckResult } from "@/hooks/use-admin-update-check";

/**
 * 「系统运维与安全」Tab 的块 4：🔄 版本与更新。
 *
 * 从 `admin-system-tab.tsx`（原 928 行）抽出 —— 挂载自检与手动检查逻辑来自
 * `useAdminUpdateCheck()`；版本号补 `v`、时间本地化与失败兜底文案见
 * `@/lib/admin-system`，本组件只负责渲染。
 */
export default function AdminSystemUpdateCard({
  update,
}: {
  update: UseAdminUpdateCheckResult;
}) {
  const tx = useTranslations();
  const locale = useLocale();
  const { checkingUpdate, updateResult, checkUpdate } = update;

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔄</span>
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            {tx("version_updates_cebbc1f6")}</h3>
          <p className="text-xs text-gray-400 dark:text-slate-400">
            {tx("check_for_updates_from_the_official_github_relea_d6648c43")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={checkUpdate}
          disabled={checkingUpdate}
          className="h-9 px-4 rounded-lg bg-[#14B8A6] hover:bg-[#0D9488] text-white text-xs font-semibold transition-colors disabled:opacity-60 cursor-pointer"
        >
          {checkingUpdate ? tx("checking_fb11aa6f") : tx("check_for_updates_7f68ebad")}
        </button>
        <span className="text-[11px] text-gray-400 dark:text-slate-400">
          {tx("current_version_435bd0f8")}{versionLabel(updateResult?.local?.version)}
          {updateResult?.local?.buildDate
            ? ` · ${formatUpdateTime(updateResult.local.buildDate, locale)}`
            : ""}
        </span>
      </div>

      {updateResult && (
        <div className="mt-3">
          {updateResult.error && (
            <p className="text-xs text-red-500">{updateResult.error}</p>
          )}
          {!updateResult.error &&
            updateResult.updateAvailable === false && (
              <p className="text-xs text-emerald-600">
                {tx("latest_release_b4546a80")}{updateResult.remote?.versionTag
                  ? ` ${updateResult.remote.versionTag}`
                  : ""}
              </p>
            )}
          {!updateResult.error &&
            updateResult.updateAvailable === true && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    {tx("new_github_release_a8a7aa5e")}{updateResult.remote?.versionTag || updateResult.remote?.title}
                  </p>
                  {updateResult.remote?.htmlUrl && (
                    <a
                      href={updateResult.remote.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-amber-700 dark:text-amber-300 font-bold underline hover:opacity-80"
                    >
                      {tx("view_release_notes_496fd865")}</a>
                  )}
                </div>
                {updateResult.remote?.lastUpdated && (
                  <p className="text-[10px] text-gray-500 dark:text-slate-400">
                    {tx("published_fe0f0c22")}{formatUpdateTime(updateResult.remote.lastUpdated, locale)}
                  </p>
                )}
                <p className="text-[11px] text-amber-600 dark:text-amber-500/80">
                  {tx("pull_the_latest_release_image_or_code_then_resta_06940de4")}</p>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
