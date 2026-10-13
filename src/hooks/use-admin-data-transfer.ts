"use client";

import { useText } from "@/hooks/use-text";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { useNavelixConfig, useNavelixData } from "@/context/navelix-context";
import { parseBookmarksHTML } from "@/lib/bookmarks";
import type { BookmarkMergeSummary } from "@/lib/bookmark-merge";
import { parseSunPanelJSON } from "@/lib/sun-panel";
import {
  personalBackupConfig,
  bookmarkImportSummary,
  buildFullExportPayload,
  fullBackupFileName,
  fullExportSummary,
  fullImportSummary,
  parseFullImportPayload,
  readLocalExportState,
  sunPanelImportSummary,
  writeLocalExportState,
} from "@/lib/admin-system";

/**
 * 「系统运维与安全」Tab 的配置与数据导入导出（块 6：📦 配置与数据导入导出）。
 *
 * 从 `admin-system-tab.tsx`（原 928 行）抽出 —— 全量 JSON 导出/导入与
 * Sun-Panel、HTML 书签两种兼容导入共用一个组件状态；载荷组装、归一化与
 * 提示文案见 `@/lib/admin-system`。三个导入都在结束后清空各自的隐藏 input，
 * 便于用户重复选择同一文件。
 */
export interface UseAdminDataTransferOptions {
  /** 仅展示 UI 提示（来自 useToast） */
  flash: (msg: string) => void;
  /** 展示 UI 提示并写入通知中心（来自 useToast） */
  notify: (title: string, msg: string) => void;
}

export interface UseAdminDataTransferResult {
  importing: boolean;
  sunPanelResult: BookmarkMergeSummary | null;
  closeSunPanelResult: () => void;
  /** 导出个人 Navelix JSON（成功后写入通知中心） */
  exportAllData: () => Promise<void>;
  /** 导入个人 Navelix JSON；成功后 1.2s 自动刷新页面 */
  /** 从个人 Navelix JSON 导入；导入结束清空传入的 input */
  importAllData: (file: File, input: HTMLInputElement | null) => void;
  /** 从 HTML 书签文件合并导入；导入结束清空传入的 input */
  importBookmarks: (file: File, input: HTMLInputElement | null) => void;
  /** 从 Sun-Panel JSON 文件合并导入；导入结束清空传入的 input */
  importSunPanel: (file: File, input: HTMLInputElement | null) => void;
}

export function useAdminDataTransfer({
  flash,
  notify,
}: UseAdminDataTransferOptions): UseAdminDataTransferResult {
  const [importing, setImporting] = useState(false);
  const [sunPanelResult, setSunPanelResult] = useState<BookmarkMergeSummary | null>(null);
  const importLock = useRef(false);
  const tx = useTranslations();
  const text = useText();
  const { config } = useNavelixConfig();
  const { categories, links, refreshData, mergeBookmarks } = useNavelixData();

  const resetFileInput = useCallback((input: HTMLInputElement | null) => {
    if (input) input.value = "";
  }, []);

  // ── 导出个人 Navelix JSON ──
  const exportAllData = useCallback(async () => {
    try {
      // 1. 先取服务端最新数据
      const res = await fetch("/api/user/data");
      const dbData = res.ok ? await res.json() : {};

      const payload = buildFullExportPayload({
        scope: "personal",
        dbData,
        fallbackConfig: config,
        fallbackCategories: categories,
        fallbackLinks: links,
        localStorageData: readLocalExportState(localStorage),
      });

      const dataStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fullBackupFileName(new Date(), "personal");
      a.click();
      URL.revokeObjectURL(url);

      notify(tx("data_management_9bb882c6"), text(fullExportSummary(payload)));
      void fetch("/api/user/telegram/data-transfer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export" }),
      }).catch(() => {});
    } catch {
      flash(tx("failed_to_export_personal_data_14055510"));
    }
  }, [config, categories, links, notify, flash, tx, text]);

  // ── 导入个人 Navelix JSON ──
  // 原文件里该 input 未挂 ref，收尾的 value 清空不可达，故此处不做清空。
  const importAllData = useCallback(
    (file: File, input: HTMLInputElement | null) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const payload = parseFullImportPayload(parsed);
          payload.config = personalBackupConfig(payload.config);

          const latest = await fetch("/api/user/data", { cache: "no-store" });
          if (!latest.ok) throw new Error("Unable to read workspace");
          const { revision } = await latest.json();
          const saveRes = await fetch("/api/user/data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dataTransferAction: "import",
              expectedRevision: revision,
              categories: payload.categories,
              links: payload.links,
              projects: payload.projects,
              todos: payload.todos,
              config: payload.config,
            }),
          });

          if (!saveRes.ok) {
            throw new Error(tx("failed_to_save_data_to_server_f53e5080"));
          }

          writeLocalExportState(localStorage, payload.localStorageData);

          refreshData();

          notify(tx("data_management_9bb882c6"), text(fullImportSummary(payload)));

          setTimeout(() => {
            window.location.reload();
          }, 1200);
        } catch {
          flash(tx("import_failed_invalid_or_damaged_json_configurat_9c219538"));
        }
        resetFileInput(input);
      };
      reader.readAsText(file);
    },
    [refreshData, notify, flash, resetFileInput, tx, text],
  );

  const importNavigation = useCallback(async (file: File, input: HTMLInputElement | null, sunPanel: boolean) => {
    if (importLock.current) { resetFileInput(input); return; }
    importLock.current = true;
    setImporting(true);
    setSunPanelResult(null);
    try {
      const content = await file.text();
      const parsed = sunPanel ? parseSunPanelJSON(content) : parseBookmarksHTML(content);
      const summary = await mergeBookmarks(parsed.categories, parsed.links);
      notify(tx("data_management_9bb882c6"), text(sunPanel ? sunPanelImportSummary(summary) : bookmarkImportSummary(summary)));
      if (sunPanel) setSunPanelResult(summary);
    } catch {
      flash(tx("navigation_import_failed"));
    } finally {
      resetFileInput(input);
      importLock.current = false;
      setImporting(false);
    }
  }, [mergeBookmarks, notify, flash, resetFileInput, tx, text]);

  const importBookmarks = (file: File, input: HTMLInputElement | null) => { void importNavigation(file, input, false); };
  const importSunPanel = (file: File, input: HTMLInputElement | null) => { void importNavigation(file, input, true); };

  return { exportAllData, importAllData, importBookmarks, importSunPanel, importing, sunPanelResult, closeSunPanelResult: () => setSunPanelResult(null) };
}
