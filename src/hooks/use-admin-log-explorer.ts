"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAdminLogs } from "@/hooks/use-admin-logs";
import { downloadAdminLogs } from "@/lib/client/admin-logs";
import { buildLogFilter, createLogFilterDraft, LOG_PAGE_SIZES, relatedLogFilter, type LogPageSize } from "@/lib/logging/filter-state";
import type { LogEvent } from "@/lib/logging/types";

export function useAdminLogExplorer(legacy: boolean) {
  const t = useTranslations();
  const [draft, setDraft] = useState(() => createLogFilterDraft(legacy));
  const [filter, setFilter] = useState(() => buildLogFilter(createLogFilterDraft(legacy), Date.now()));
  const [cursors, setCursors] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState<LogPageSize>(20);
  const [selected, setSelected] = useState<LogEvent | null>(null);
  const [notice, setNotice] = useState("");
  const params = new URLSearchParams(filter);
  params.set("limit", String(pageSize));
  if (cursors.length) params.set("cursor", cursors[cursors.length - 1]);
  const logs = useAdminLogs(params.toString());
  const apply = () => {
    try { setFilter(buildLogFilter(draft, Date.now())); setCursors([]); setNotice(""); logs.refresh(); }
    catch { setNotice(t("logs_error")); }
  };
  const selectCategory = (category: string) => {
    setDraft(current => ({ ...current, category }));
    setFilter(current => {
      const query = new URLSearchParams(current);
      if (category) query.set("category", category); else query.delete("category");
      return query.toString();
    });
    setCursors([]);
  };
  const changePageSize = (size: number) => {
    if (LOG_PAGE_SIZES.some(value => value === size)) { setPageSize(size as LogPageSize); setCursors([]); }
  };
  const showRelated = () => {
    if (!selected?.operationId) return;
    const next = relatedLogFilter(selected);
    setDraft(next); setFilter(buildLogFilter(next, Date.now())); setCursors([]); setSelected(null); setNotice("");
  };
  const exportLogs = async (format: "csv" | "jsonl") => {
    setNotice("");
    try { await downloadAdminLogs(filter, format); }
    catch { setNotice(t("logs_exportFailed")); }
  };
  return {
    ...logs, draft, setDraft, pageSize, selected, setSelected, notice, apply, selectCategory,
    changePageSize, showRelated, exportLogs, currentPage: cursors.length + 1,
    refreshFirst: () => { setCursors([]); logs.refresh(); },
    previous: () => setCursors(current => current.slice(0, -1)),
    next: () => { const cursor = logs.page.nextCursor; if (cursor) setCursors(current => [...current, cursor]); },
  };
}
