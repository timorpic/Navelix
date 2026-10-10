"use client";

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
  const { checkingUpdate, updateResult, checkUpdate } = update;

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100 dark:border-slate-700 shadow-2xs transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔄</span>
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            版本与更新
          </h3>
          <p className="text-xs text-gray-400 dark:text-slate-400">
            连接 GitHub Releases 官方发布源自检版本
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={checkUpdate}
          disabled={checkingUpdate}
          className="h-9 px-4 rounded-lg bg-[#14B8A6] hover:bg-[#0D9488] text-white text-xs font-semibold transition-colors disabled:opacity-60 cursor-pointer"
        >
          {checkingUpdate ? "检查中…" : "检查更新"}
        </button>
        <span className="text-[11px] text-gray-400 dark:text-slate-400">
          当前版本：
          {versionLabel(updateResult?.local?.version)}
          {updateResult?.local?.buildDate
            ? ` · ${formatUpdateTime(updateResult.local.buildDate)}`
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
                ✅ Release 最新
                {updateResult.remote?.versionTag
                  ? ` ${updateResult.remote.versionTag}`
                  : ""}
              </p>
            )}
          {!updateResult.error &&
            updateResult.updateAvailable === true && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    🚀 检测到 GitHub 新版本：{updateResult.remote?.versionTag || updateResult.remote?.title}
                  </p>
                  {updateResult.remote?.htmlUrl && (
                    <a
                      href={updateResult.remote.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-amber-700 dark:text-amber-300 font-bold underline hover:opacity-80"
                    >
                      查看发行日志 ↗
                    </a>
                  )}
                </div>
                {updateResult.remote?.lastUpdated && (
                  <p className="text-[10px] text-gray-500 dark:text-slate-400">
                    发布时间：{formatUpdateTime(updateResult.remote.lastUpdated)}
                  </p>
                )}
                <p className="text-[11px] text-amber-600 dark:text-amber-500/80">
                  请拉取最新 Release 镜像或代码并重启容器完成更新。
                </p>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
