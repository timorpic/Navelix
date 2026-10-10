"use client";

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
  const [isRestoringDb, setIsRestoringDb] = useState(false);
  const [backupNotice, setBackupNotice] = useState("");

  // ── 下载：浏览器直接打开备份接口，另给一条通知中心提示 ──
  const downloadDbBackup = useCallback(() => {
    window.open("/api/admin/backup", "_blank");
    notify("数据库备份", "正在生成并下载数据库物理快照");
  }, [notify]);

  const restoreDatabase = useCallback(
    async (file: File) => {
      setIsRestoringDb(true);
      setBackupNotice("正在还原数据库，请稍候...");
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/backup", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        const outcome = parseDbRestoreResult(res.ok, data);
        setBackupNotice(outcome.notice);
        if (outcome.ok) {
          notify("数据库还原", "数据还原成功，页面即将刷新");
          setTimeout(() => window.location.reload(), 1500);
        }
      } catch {
        setBackupNotice("❌ 还原请求失败，请检查网络");
      } finally {
        setIsRestoringDb(false);
      }
    },
    [notify],
  );

  return { isRestoringDb, backupNotice, downloadDbBackup, restoreDatabase };
}
