"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAdminLogExplorer } from "@/hooks/use-admin-log-explorer";
import AdminLogFilters from "./admin-log-filters";
import AdminLogTable from "./admin-log-table";
import AdminLogPagination from "./admin-log-pagination";
import { logControl } from "./admin-log-styles";
import Modal from "@/components/modal";
import AdminLogsSettings from "./admin-logs-settings";

export default function AdminLogsPanel({ legacy = false }: { legacy?: boolean }) {
  const t = useTranslations();
  const [tab, setTab] = useState("events");
  const {
    page, loading, error, autoRefresh, setAutoRefresh, newLogs, draft, setDraft, pageSize,
    selected, setSelected, notice, apply, selectCategory, changePageSize, showRelated, exportLogs,
    currentPage, refreshFirst, previous, next,
  } = useAdminLogExplorer(legacy);
  const control = logControl;
  return <section aria-busy={loading} className="rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-4 sm:p-6 space-y-5 text-gray-900 dark:text-white">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">{t("logs_title")}</h2><p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t("logs_description")}</p></div><div className="flex gap-2">{["events", "settings"].map(key => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)} className={`${control} ${tab === key ? "text-[#00C776]" : ""}`}>{t(`logs_${key}`)}</button>)}</div></div>
    {tab === "settings" ? <AdminLogsSettings /> : <>
      <AdminLogFilters draft={draft} onChange={setDraft} onApply={apply} onCategory={selectCategory} />
      <div className="flex flex-wrap items-center gap-3"><button className={control} onClick={refreshFirst}>{t("logs_refresh")}</button><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />{t("logs_autoRefresh")}</label><button className={control} onClick={() => exportLogs("jsonl")}>{t("logs_export")} JSONL</button><button className={control} onClick={() => exportLogs("csv")}>{t("logs_export")} CSV</button>{newLogs && <button className="text-sm text-[#00C776]" onClick={refreshFirst}>{t("logs_newLogs")}</button>}</div>
      {notice && <p role="alert" className="text-sm text-rose-500">{notice}</p>}
      {page.partial && <p role="status" className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-400">{t("logs_partial")}</p>}
      {error ? <p role="alert" className="text-sm text-rose-500">{t("logs_error")}</p> : loading ? <p role="status" className="py-10 text-center text-sm text-gray-500">{t("logs_loading")}</p> : !page.logs.length ? <p className="py-10 text-center text-sm text-gray-500">{t("logs_empty")}</p> : <AdminLogTable logs={page.logs} onSelect={setSelected} />}
      <AdminLogPagination pageSize={pageSize} currentPage={currentPage} total={page.total} partial={page.partial}
        hasNext={Boolean(page.nextCursor)} disabled={loading || error} onPageSizeChange={changePageSize} onPrevious={previous} onNext={next} />
    </>}
    <Modal open={selected !== null} title={t("logs_details")} onClose={() => setSelected(null)} manageFocus><div className="max-h-[65dvh] overflow-y-auto space-y-4">{selected && <><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(selected, null, 2)}</pre>{selected.operationId && <button className="text-sm text-[#00C776]" onClick={showRelated}>{t("logs_related")}</button>}</>}</div></Modal>
  </section>;
}
