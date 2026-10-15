import type { LogCleanupPreview, LogCleanupResult, LogPage, LogSettings, LogStatistics } from "../logging/types.ts";

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  if (!response.ok) throw new Error("log-request-failed");
  const data: unknown = await response.json();
  return data as T;
}
function jsonBody(body: unknown, method = "POST"): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
export const adminLogsApi = {
  query: (params: string, signal?: AbortSignal) => requestJson<LogPage>(`/api/admin/logs?${params}`, { signal }),
  settings: (signal?: AbortSignal) => requestJson<{ settings: LogSettings }>("/api/admin/logs/settings", { signal }),
  statistics: (signal?: AbortSignal) => requestJson<LogStatistics>("/api/admin/logs/stats", { signal }),
  preview: (settings: Partial<LogSettings>) => requestJson<LogCleanupPreview>("/api/admin/logs/cleanup-preview", jsonBody({ settings })),
  save: (settings: Partial<LogSettings>, token: string) => requestJson<{ settings: LogSettings }>("/api/admin/logs/settings", jsonBody({ settings, token }, "PATCH")),
  cleanup: (token: string) => requestJson<LogCleanupResult>("/api/admin/logs/cleanup", jsonBody({ token })),
};

export async function downloadAdminLogs(filter: string, format: "csv" | "jsonl"): Promise<void> {
  const params = new URLSearchParams(filter); params.set("format", format);
  const response = await fetch(`/api/admin/logs/export?${params}`, { method: "POST" });
  if (!response.ok) throw new Error("log-export-failed");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a"); link.href = url; link.download = `navelix-logs.${format}`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
