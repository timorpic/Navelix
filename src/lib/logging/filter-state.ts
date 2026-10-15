import type { LogEvent } from "./types.ts";

export const LOG_PAGE_SIZES = [20, 50, 100] as const;
export type LogPageSize = typeof LOG_PAGE_SIZES[number];
export const LOG_SELECT_OPTIONS = {
  level: ["debug", "info", "warn", "error"],
  outcome: ["started", "succeeded", "failed", "cancelled", "skipped", "exhausted", "unknown"],
  kind: ["audit", "business", "runtime", "request"],
  source: ["web", "api", "scheduler", "frontend", "system"],
} as const;
export function createLogFilterDraft(legacy = false) {
  return { category: "", level: "", outcome: "", kind: legacy ? "audit" : "", module: "", actorId: "", source: "", q: "", event: "", requestId: "", operationId: "", hours: "24", start: "", end: "" };
}
export type LogFilterDraft = ReturnType<typeof createLogFilterDraft>;

export function buildLogFilter(draft: LogFilterDraft, now: number): string {
  const from = draft.start ? new Date(draft.start).getTime() : now - Number(draft.hours) * 3600000;
  const to = draft.end ? new Date(draft.end).getTime() : now;
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to < from) throw new Error("Invalid log time range");
  const query = new URLSearchParams({ from: String(from) });
  for (const [key, value] of Object.entries(draft)) {
    if (!["hours", "start", "end"].includes(key) && value) query.set(key, value);
  }
  if (draft.end) query.set("to", String(to));
  return query.toString();
}
export function relatedLogFilter(log: Pick<LogEvent, "operationId" | "timestamp">): LogFilterDraft {
  const from = Math.max(0, log.timestamp - 86400_000);
  const local = new Date(from - new Date(from).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return { ...createLogFilterDraft(), operationId: log.operationId, start: local };
}
