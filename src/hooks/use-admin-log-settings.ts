"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConfirmOptions } from "@/hooks/use-confirm";
import { adminLogsApi } from "@/lib/client/admin-logs";
import { createLogManagementWorkflow, LOG_MANAGEMENT_HANDLERS } from "@/lib/logging/management-workflow";
import type { LogSettings, LogStatistics } from "@/lib/logging/types";
import { executeWorkflow } from "@/lib/workflows/execute";

export function useAdminLogSettings(confirm: (options: ConfirmOptions) => Promise<boolean>) {
  const t = useTranslations();
  const [settings, setSettings] = useState<LogSettings | null>(null);
  const [stats, setStats] = useState<LogStatistics | null>(null);
  const [loadRevision, setLoadRevision] = useState(0);
  const [cleanupDialog, setCleanupDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const busyRef = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    // Independent requests: slow/unavailable statistics never block the settings form.
    adminLogsApi.settings(controller.signal).then(config => {
      if (active) setSettings(config.settings);
    }).catch(() => { if (active) setStatus(t("logs_error")); });
    adminLogsApi.statistics(controller.signal).then(summary => {
      if (active) setStats(summary);
    }).catch(() => { /* Statistics are optional; management remains available. */ });
    return () => { active = false; controller.abort(); };
  }, [t, loadRevision]);

  const update = <K extends keyof LogSettings>(key: K, value: LogSettings[K]) => {
    if (!busyRef.current) setSettings(current => current ? { ...current, [key]: value } : current);
  };
  const perform = async (cleanup: boolean) => {
    if (!settings || busyRef.current) return;
    busyRef.current = true; setBusy(true); setStatus(""); setCleanupDialog(cleanup);
    try {
      const patch: Partial<LogSettings> = { ...settings };
      delete patch.debugUntil;
      const result = await executeWorkflow(createLogManagementWorkflow(cleanup, patch), LOG_MANAGEMENT_HANDLERS, {
        api: adminLogsApi,
        preview: null,
        confirm: (preview, cleaning) => confirm({
          title: t(cleaning ? "logs_cleanup" : "logs_save"),
          confirmLabel: t(cleaning ? "logs_confirmCleanup" : "logs_confirmSave"),
          message: t(cleaning ? "logs_cleanupPreview" : "logs_savePreview", { v0: preview.auditCount, v1: preview.files, v2: (preview.bytes / 1048576).toFixed(1) }),
        }),
        onNothingToClean: preview => setStatus(t("logs_nothingToClean", {
          v0: preview.settings.auditRetentionDays === 0 ? t("logs_forever") : `${preview.settings.auditRetentionDays} ${t("logs_days")}`,
          v1: preview.settings.runtimeRetentionDays, v2: preview.settings.businessRetentionDays,
        })),
        onSaved: saved => { setSettings(saved); setStatus(t("logs_saved")); },
        onCleaned: cleaned => {
          const summary = t("logs_cleanupResult", { v0: cleaned.auditCount, v1: cleaned.removed, v2: (cleaned.releasedBytes / 1048576).toFixed(2) });
          setStatus(cleaned.partial ? `${summary} ${t("logs_cleanupPartial")}` : summary);
        },
      });
      if (result.status === "completed") {
        // Optional follow-up failure must not replace a successful operation status.
        try { setStats(await adminLogsApi.statistics()); } catch { setStats(null); }
      }
    } catch { setStatus(t("logs_error")); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const retry = () => { setStatus(""); setLoadRevision(value => value + 1); };
  return { settings, stats, busy, status, cleanupDialog, update, perform, retry };
}
