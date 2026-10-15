"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { adminLogsApi } from "@/lib/client/admin-logs";
import type { LogPage } from "@/lib/logging/types";
export function useAdminLogs(params: string) {
  const [page, setPage] = useState<LogPage>({ logs: [], total: 0, nextCursor: null, partial: false, warnings: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [newLogs, setNewLogs] = useState(false);
  const [revision, setRevision] = useState(0);
  const latestId = useRef("");
  const refresh = useCallback(() => { setNewLogs(false); setRevision(n => n + 1); }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    queueMicrotask(() => { if (active) { setLoading(true); setError(false); setNewLogs(false); } });
    adminLogsApi.query(params, controller.signal).then(data => {
      if (active) { setPage(data); if (!new URLSearchParams(params).has("cursor")) latestId.current = data.logs[0]?.id ?? ""; }
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [params, revision]);
  useEffect(() => {
    if (!autoRefresh) return;
    const controller = new AbortController();
    let busy = false;
    const timer = setInterval(async () => {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const query = new URLSearchParams(params); query.delete("cursor"); query.set("limit", "1");
        const data = await adminLogsApi.query(query.toString(), controller.signal);
        if (data.logs[0] && data.logs[0].id !== latestId.current) setNewLogs(true);
      } catch { /* Keep the visible page; the refresh action can retry. */ }
      finally { busy = false; }
    }, 5000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [autoRefresh, params]);
  return { page, loading, error, autoRefresh, setAutoRefresh, newLogs, refresh };
}
