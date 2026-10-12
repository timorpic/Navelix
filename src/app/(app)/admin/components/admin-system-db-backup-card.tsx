"use client";

import { useTranslations } from "next-intl";
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
  const tx = useTranslations();
  const dbRestoreFileRef = useRef<HTMLInputElement>(null);
  const confirmDialog = useConfirm();

  const handleUploadDbRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    const okToRestore = await confirmDialog.confirm({
      title: tx("restore_database_e735c566"),
      message: tx("restoring_a_database_overwrites_all_current_data_6073ad42"),
      confirmLabel: tx("restore_ddde0894"),
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
          <span>{tx("database_snapshots_restore_f1d98d6a")}</span>
        </h3>
        <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
          {tx("download_a_sqlite_database_db_or_restore_all_dat_4726afab")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="bg-emerald-50/40 dark:bg-emerald-950/30 rounded-2xl p-4 border border-emerald-200/60 dark:border-emerald-900/60 space-y-2.5 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
              <span>📥</span>
              <span>{tx("download_sqlite_backup_202ef55c")}</span>
            </h4>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-1 leading-relaxed">
              {tx("create_a_complete_online_database_snapshot_db_fo_d98d9f16")}</p>
          </div>
          <button
            type="button"
            onClick={db.downloadDbBackup}
            className="w-full py-2 bg-[#00C776] hover:bg-[#009a5a] text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span>📥</span>
            <span>{tx("download_database_backup_db_923bf239")}</span>
          </button>
        </div>

        <div className="bg-gray-50/60 dark:bg-slate-900/40 rounded-2xl p-4 border border-gray-200 dark:border-slate-700 space-y-2.5 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <span>📤</span>
              <span>{tx("upload_restore_database_863e0b23")}</span>
            </h4>
            <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-1 leading-relaxed">
              {tx("restore_a_previously_exported_db_file_the_databa_37002108")}</p>
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
            <span>{db.isRestoringDb ? tx("restoring_005d3f2a") : tx("choose_db_backup_restore_bd33f26e")}</span>
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
