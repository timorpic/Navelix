"use client";

import { formatBackupSize, formatBackupTime } from "@/lib/admin-pro";
import type { RemoteBackupItem } from "@/lib/storage-provider";

/**
 * 「Pro 商业授权」Tab 的弹窗 2：📋 云端快照列表与一键还原弹窗。
 *
 * 从 `admin-pro-tab.tsx`（原 1018 行）抽出 —— 列表拉取与还原操作
 * （含二次确认、还原成功后的 alert + 整页刷新）全部来自
 * `useAdminCloudStorage()`，本组件只负责渲染快照条目。
 */
export default function AdminProBackupListModal({
  loading,
  backups,
  restoringFileName,
  onRestore,
  onClose,
}: {
  loading: boolean;
  backups: RemoteBackupItem[];
  /** 正在还原的快照文件名（按钮进入禁用态） */
  restoringFileName: string | null;
  onRestore: (fileName: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-gray-100 dark:border-slate-800 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xl font-bold">
              ☁️
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                云端物理快照列表与一键还原
              </h3>
              <p className="text-xs text-gray-400 dark:text-slate-400">
                可随时拉取历史备份覆盖还原，还原前系统将自动生成安全回滚快照
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-400 hover:text-gray-700 dark:hover:text-white flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2.5">
          {loading ? (
            <div className="py-8 text-center text-xs text-gray-400 animate-pulse">正在连接远程存储检索快照列表中…</div>
          ) : backups.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">云存储中暂无历史备份快照</div>
          ) : (
            backups.map((b) => (
              <div
                key={b.name}
                className="p-3.5 rounded-2xl bg-gray-50 dark:bg-slate-800/80 border border-gray-200/80 dark:border-slate-700 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-white font-mono">{b.name}</p>
                  <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-0.5">
                    大小：{formatBackupSize(b.size)} · 备份时间：{formatBackupTime(b.lastModified)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={restoringFileName === b.name}
                  onClick={() => onRestore(b.name)}
                  className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold text-xs shrink-0 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                >
                  {restoringFileName === b.name ? "正在还原中…" : "🔄 一键还原"}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
