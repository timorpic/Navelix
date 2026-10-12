"use client";

import { useText } from "@/hooks/use-text";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { parseDbRestoreResult } from "@/lib/admin-system";

/**
 * 「系统运维与安全」Tab 的数据库物理快照下载与上传还原（块 5：💾 数据库物理快照与备份还原）。
 *
 * 从 `admin-system-tab.tsx`（原 928 行）抽出 —— 还原过程的 loading / 内联提示
 * 与二次确认原先和版本自检、导入导出等状态混在一起。还原请求必须携带文件，
 * 因此 `restoreDatabase` 只接收文件，不接收表单事件；隐藏 input 的清空由
 * 卡片组件在「选完 / 取消」后自行负责。
 */
export interface UseAdminDbBackupOptions {
  /** 展示 UI 提示并写入通知中心（来自 useToast） */
  notify: (title: string, msg: string) => void;
}

export interface UseAdminDbBackupResult {
  isRestoringDb: boolean;
  /** 卡片内联提示（还原中 / 成功 / 失败） */
  backupNotice: string;
  /** 下载数据库物理快照 */
  downloadDbBackup: () => void;
  /** 上传并还原数据库；成功后 1.5s 自动刷新页面 */
  restoreDatabase: (file: File) => Promise<void>;
}

export function useAdminDbBackup({
  notify,
}: UseAdminDbBackupOptions): UseAdminDbBackupResult {
  const tx = useTranslations();
  const text = useText();
  const [isRestoringDb, setIsRestoringDb] = useState(false);
  const [backupNotice, setBackupNotice] = useState("");

  // ── 下载：浏览器直接打开备份接口，另给一条通知中心提示 ──
  const downloadDbBackup = useCallback(() => {
    window.open("/api/admin/backup", "_blank");
    notify(tx("database_backup_4431acae"), tx("creating_and_downloading_a_database_snapshot_ec9075ce"));
  }, [notify, tx]);

  const restoreDatabase = useCallback(
    async (file: File) => {
      setIsRestoringDb(true);
      setBackupNotice(tx("restoring_database_please_wait_1f497c09"));
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/backup", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        const outcome = parseDbRestoreResult(res.ok, data);
        setBackupNotice(text(outcome.notice));
        if (outcome.ok) {
          notify(tx("database_restore_5b0921b2"), tx("data_restored_the_page_will_refresh_shortly_6ee33262"));
          setTimeout(() => window.location.reload(), 1500);
        }
      } catch {
        setBackupNotice(tx("restore_failed_check_your_connection_66a068f3"));
      } finally {
        setIsRestoringDb(false);
      }
    },
    [notify, tx, text],
  );

  return { isRestoringDb, backupNotice, downloadDbBackup, restoreDatabase };
}
