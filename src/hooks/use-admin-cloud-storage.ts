"use client";

import { useText } from "@/hooks/use-text";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_CLOUD_STORAGE_CONFIG,
  parseRemoteBackupList,
  parseStorageConfig,
  parseStorageRestoreResult,
  storageBackupMessage,
  storageSaveMessage,
  storageTestMessage,
  storageTypePatch,
} from "@/lib/admin-pro";
import type { CloudStorageConfig, RemoteBackupItem } from "@/lib/storage-provider";

/**
 * 管理后台「Pro 商业授权」Tab 的 S3 / WebDAV 异地云容灾备份状态。
 *
 * 从 `admin-pro-tab.tsx`（原 1018 行）抽出 —— 该文件把商业授权、
 * 云存储备份、书签探针、品牌 LOGO 与代码注入五块互不相关的设置
 * 连同 13 个 useState 塞在一起。本 hook 持有云存储域的 8 个 state
 * 与四个接口调用；授权见 `use-admin-license`。提示与确认弹窗由调用方注入。
 */

interface UseAdminCloudStorageOptions {
  /** 仅展示 UI 提示（来自 useToast） */
  flash: (msg: string) => void;
  /** Promise 风格的确认弹窗（来自 useConfirm） */
  confirm: (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => Promise<boolean>;
}

export interface UseAdminCloudStorageResult {
  storageConfig: CloudStorageConfig;
  /** 表单输入的本地更新（不入库，等待失焦 / 切换时保存） */
  setStorageConfig: (next: CloudStorageConfig) => void;
  /** 切换存储类型：本地更新后立即保存 */
  selectStorageType: (type: string) => void;
  /** 保存配置；不传时提交当前 state（失焦保存路径） */
  saveStorageConfig: (next?: CloudStorageConfig) => Promise<void>;
  testingStorage: boolean;
  backingUpNow: boolean;
  testStorage: () => Promise<void>;
  backupNow: () => Promise<void>;
  loadingBackups: boolean;
  remoteBackups: RemoteBackupItem[];
  showBackupListModal: boolean;
  /** 打开云端快照弹窗并拉取列表 */
  openRemoteBackupList: () => Promise<void>;
  closeBackupListModal: () => void;
  restoringFileName: string | null;
  /** 从云端快照还原数据库（含二次确认；成功后 alert + 整页刷新） */
  restoreFromCloud: (fileName: string) => Promise<void>;
}

export function useAdminCloudStorage({
  flash,
  confirm,
}: UseAdminCloudStorageOptions): UseAdminCloudStorageResult {
  const tx = useTranslations();
  const text = useText();
  // ── 云存储配置与操作 ──
  const [storageConfig, setStorageConfig] = useState<CloudStorageConfig>(
    DEFAULT_CLOUD_STORAGE_CONFIG,
  );
  const [testingStorage, setTestingStorage] = useState(false);
  const [backingUpNow, setBackingUpNow] = useState(false);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [remoteBackups, setRemoteBackups] = useState<RemoteBackupItem[]>([]);
  const [showBackupListModal, setShowBackupListModal] = useState(false);
  const [restoringFileName, setRestoringFileName] = useState<string | null>(null);

  const fetchStorageConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/storage");
      if (res.ok) {
        const data = await res.json();
        const patch = parseStorageConfig(data);
        if (patch) {
          setStorageConfig((prev) => ({ ...prev, ...patch }));
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchStorageConfig();
    });
  }, [fetchStorageConfig]);

  const saveStorageConfig = useCallback(
    async (next?: CloudStorageConfig) => {
      const cfg = next ?? storageConfig;
      try {
        const res = await fetch("/api/admin/storage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cfg),
        });
        const data = await res.json();
        flash(text(storageSaveMessage(res.ok, data)));
      } catch {
        flash(tx("request_failed_10d559a3"));
      }
    },
    [storageConfig, flash, tx, text],
  );

  // 切换存储类型：先本地生效，再整份提交（enabled 随「关闭云备份」推导）
  const selectStorageType = useCallback(
    (type: string) => {
      const next = storageTypePatch(storageConfig, type);
      setStorageConfig(next);
      saveStorageConfig(next);
    },
    [storageConfig, saveStorageConfig],
  );

  const testStorage = useCallback(async () => {
    setTestingStorage(true);
    try {
      const res = await fetch("/api/admin/storage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", tempConfig: storageConfig }),
      });
      const data = await res.json();
      flash(text(storageTestMessage(res.ok, data)));
    } catch {
      flash(tx("connection_test_timed_out_or_failed_986fbc96"));
    } finally {
      setTestingStorage(false);
    }
  }, [storageConfig, flash, tx, text]);

  const backupNow = useCallback(async () => {
    setBackingUpNow(true);
    try {
      const res = await fetch("/api/admin/storage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "backup_now", tempConfig: storageConfig }),
      });
      const data = await res.json();
      flash(text(storageBackupMessage(res.ok, data)));
    } catch {
      flash(tx("backup_request_failed_4d5cd5f1"));
    } finally {
      setBackingUpNow(false);
    }
  }, [storageConfig, flash, tx, text]);

  const openRemoteBackupList = useCallback(async () => {
    setShowBackupListModal(true);
    setLoadingBackups(true);
    try {
      const res = await fetch("/api/admin/storage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", tempConfig: storageConfig }),
      });
      const data = await res.json();
      const backups = parseRemoteBackupList(res.ok, data);
      if (backups) {
        setRemoteBackups(backups);
      }
    } catch {
      flash(tx("failed_to_fetch_cloud_snapshots_eb2fa6bc"));
    } finally {
      setLoadingBackups(false);
    }
  }, [storageConfig, flash, tx]);

  const closeBackupListModal = useCallback(() => setShowBackupListModal(false), []);

  const restoreFromCloud = useCallback(
    async (fileName: string) => {
      const okToRestore = await confirm({
        title: tx("restore_from_cloud_3d2bb2b2"),
        message: tx("message_e77af1045916", {v0: fileName}),
        confirmLabel: tx("restore_ddde0894"),
      });
      if (!okToRestore) {
        return;
      }
      setRestoringFileName(fileName);
      try {
        const res = await fetch("/api/admin/storage", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "restore", fileName, tempConfig: storageConfig }),
        });
        const data = await res.json();
        const outcome = parseStorageRestoreResult(res.ok, data);
        if (outcome.ok) {
          // 此处刻意保留原生 alert：紧随其后的整页刷新会立刻卸载 React 树，
          // 换成 Toast 用户根本来不及看清。
          alert(tx("database_restored_the_page_will_refresh_automati_4887460e"));
          window.location.reload();
        } else {
          flash(text(outcome.message));
        }
      } catch {
        flash(tx("restore_request_failed_0d58cc52"));
      } finally {
        setRestoringFileName(null);
      }
    },
    [confirm, storageConfig, flash, tx, text],
  );

  return {
    storageConfig,
    setStorageConfig,
    selectStorageType,
    saveStorageConfig,
    testingStorage,
    backingUpNow,
    testStorage,
    backupNow,
    loadingBackups,
    remoteBackups,
    showBackupListModal,
    openRemoteBackupList,
    closeBackupListModal,
    restoringFileName,
    restoreFromCloud,
  };
}
