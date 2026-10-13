"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import Modal from "@/components/modal";
import type { UseAdminDataTransferResult } from "@/hooks/use-admin-data-transfer";

export default function SunPanelImportResult({ transfer }: { transfer: UseAdminDataTransferResult }) {
  const tx = useTranslations();
  const result = transfer.sunPanelResult;
  return <Modal manageFocus open={result !== null} title={tx("sun_panel_import_complete")} onClose={transfer.closeSunPanelResult}>
    {result && <p className="text-sm leading-relaxed" role="status">{tx("sun_panel_import_counts", { v0: result.categories, v1: result.links, v2: result.skipped })}</p>}
    <p className="mt-3 text-sm text-gray-500 dark:text-slate-400">{tx("sun_panel_merge_trust")}</p>
    <div className="mt-5 flex flex-wrap gap-3 text-sm">
      <Link className="rounded-xl bg-emerald-600 px-4 py-2 text-white" href="/?tab=feature-projects" onClick={transfer.closeSunPanelResult}>{tx("sun_panel_next_project")}</Link>
      <Link className="rounded-xl border border-gray-200 px-4 py-2 dark:border-slate-600" href="/?tab=feature-calendar" onClick={transfer.closeSunPanelResult}>{tx("sun_panel_next_calendar")}</Link>
    </div>
    <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">{tx("sun_panel_next_ai")}</p>
  </Modal>;
}
