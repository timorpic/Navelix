"use client";

import React, { useRef } from "react";
import ConfirmDialog from "@/components/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import type { UseAdminDbBackupResult } from "@/hooks/use-admin-db-backup";

/**
 * 「系统运维与安全」Tab 的块 5：💾 数据库物理快照与备份还原。
 *
 * 从 `admin-system-tab.tsx`（原 928 行）抽出 —— 下载与还原逻辑来自
 * `useAdminDbBackup()`，本组件保留上传链路：文件输入框是非受控的，选中的
 * `File` 必须活过 `confirm()` 的 await（闭包捕获的 `file` 常量即可，
 * 不能再从已回收的事件对象上取）；取消路径清空 input.value，否则再次选择
 * 同一文件不会触发 change 事件。
 */
export default function AdminSystemDbBackupCard({
  db,
}: {
  db: UseAdminDbBackupResult;
}) {
  const dbRestoreFileRef = useRef<HTMLInputElement>(null);
  const confirmDialog = useConfirm();

  const handleUploadDbRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    const okToRestore = await confirmDialog.confirm({
      title: "还原数据库",
      message: "⚠️ 警告：恢复数据库将同步覆盖当前全量数据。确定要还原此数据库备份文件吗？",
      confirmLabel: "还原",
    });
    if (!okToRestore) {
      // 取消时清空 input，否则再次选择同一文件不会触发 change 事件
      input.value = "";
      return;
    }
    await db.restoreDatabase(file);
    input.value = "";
  };

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-emerald-100 dark:border-emerald-950/80 shadow-2xs space-y-4 transition-colors">
      <ConfirmDialog {...confirmDialog.dialogProps} />

      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
          <span>💾</span>
          <span>数据库物理快照与备份还原</span>
        </h3>
        <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
          一键下载当前 SQLite 数据库文件（.db），或上传历史快照无缝恢复全量数据
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="bg-emerald-50/40 dark:bg-emerald-950/30 rounded-2xl p-4 border border-emerald-200/60 dark:border-emerald-900/60 space-y-2.5 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
              <span>📥</span>
              <span>下载 SQLite 数据库备份</span>
            </h4>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-1 leading-relaxed">
              在线无锁生成当前完整数据库物理文件（.db），换机、迁移或容灾备份首选。
            </p>
          </div>
          <button
            type="button"
            onClick={db.downloadDbBackup}
            className="w-full py-2 bg-[#00C776] hover:bg-[#009a5a] text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>📥</span>
            <span>下载数据库备份 (.db)</span>
          </button>
        </div>

        <div className="bg-gray-50/60 dark:bg-slate-900/40 rounded-2xl p-4 border border-gray-200 dark:border-slate-700 space-y-2.5 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <span>📤</span>
              <span>上传还原数据库</span>
            </h4>
            <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-1 leading-relaxed">
              选择先前导出的 .db 文件一键还原（还原后自动重新校验数据库版本）。
            </p>
          </div>
          <input
            ref={dbRestoreFileRef}
            type="file"
            accept=".db,application/x-sqlite3"
            className="hidden"
            onChange={handleUploadDbRestore} name="dbRestoreFile"
          />
          <button
            type="button"
            disabled={db.isRestoringDb}
            onClick={() => dbRestoreFileRef.current?.click()}
            className="w-full py-2 bg-gray-900 dark:bg-slate-700 hover:bg-black dark:hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>📤</span>
            <span>{db.isRestoringDb ? "正在还原中..." : "选择 .db 备份并还原"}</span>
          </button>
        </div>
      </div>

      {db.backupNotice && (
        <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-800 dark:text-slate-200 animate-fadeIn">
          {db.backupNotice}
        </div>
      )}
    </div>
  );
}
