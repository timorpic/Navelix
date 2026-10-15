import { createHash } from "node:crypto";
import { db } from "../db.ts";
import { categoryForEvent } from "./catalog.ts";
import { createLogEvent } from "./events.ts";
import { LOG_CATEGORIES, type LogEvent, type LogFilter, type LogPage } from "./types.ts";
import { listLogFiles, readLogTail, flushLogs, readFileIndex } from "./store.ts";
import { safeIdentifier, sanitizeDetails } from "./redact.ts";

export function parseLogFilter(params: URLSearchParams): LogFilter {
  const from = params.has("from") ? Number(params.get("from")) : Date.now() - 86400_000;
  const to = params.has("to") ? Number(params.get("to")) : Date.now();
  if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to < from || to > Date.now() + 60_000) throw new Error("Invalid time range");
  const filter: LogFilter = { from, to };
  const enums = { category: Object.keys(LOG_CATEGORIES), level: ["debug", "info", "warn", "error"],
    outcome: ["started", "succeeded", "failed", "cancelled", "skipped", "exhausted", "unknown"],
    kind: ["audit", "business", "runtime", "request"], source: ["web", "api", "scheduler", "frontend", "system"] };
  for (const [key, values] of Object.entries(enums)) {
    const value = params.get(key);
    if (value && !values.includes(value)) throw new Error(`Invalid ${key}`);
    if (value) Object.assign(filter, { [key]: value });
  }
  for (const key of ["module", "actorId", "event", "q", "requestId", "operationId"] as const) {
    const value = params.get(key)?.trim();
    if (value && value.length > 160) throw new Error(`Invalid ${key}`);
    if (value) filter[key] = value;
  }
  return filter;
}
export function matchesFilter(event: LogEvent, filter: LogFilter): boolean {
  if (event.timestamp < filter.from || event.timestamp > filter.to) return false;
  for (const key of ["category", "module", "level", "outcome", "kind", "actorId", "source", "event", "requestId", "operationId"] as const) {
    if (filter[key] && event[key] !== filter[key]) return false;
  }
  if (filter.q && !JSON.stringify(event).toLowerCase().includes(filter.q.toLowerCase())) return false;
  return true;
}
/** Revalidate persisted input; old files and snapshots are not trusted event objects. */
export function decodeLogEvent(raw: unknown): LogEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.schemaVersion !== 1 || typeof row.id !== "string" || !safeIdentifier(row.id) || typeof row.timestamp !== "number" || !Number.isFinite(row.timestamp) || typeof row.category !== "string" || !Object.hasOwn(LOG_CATEGORIES, row.category) || typeof row.event !== "string") return null;
  const event = createLogEvent({ category: row.category as LogEvent["category"], event: row.event,
    module: typeof row.module === "string" ? row.module : undefined,
    kind: ["audit", "business", "runtime", "request"].includes(String(row.kind)) ? row.kind as LogEvent["kind"] : "runtime",
    level: ["debug", "info", "warn", "error"].includes(String(row.level)) ? row.level as LogEvent["level"] : "info",
    outcome: ["started", "succeeded", "failed", "cancelled", "skipped", "exhausted"].includes(String(row.outcome)) ? row.outcome as LogEvent["outcome"] : "unknown",
    actorId: typeof row.actorId === "string" ? row.actorId : "", actorType: row.actorType === "anonymous" ? "anonymous" : row.actorType === "user" ? "user" : "system",
    subjectType: typeof row.subjectType === "string" ? row.subjectType : "", subjectId: typeof row.subjectId === "string" ? row.subjectId : "",
    operationId: typeof row.operationId === "string" ? row.operationId : "", parentId: typeof row.parentId === "string" ? row.parentId : "",
    message: typeof row.message === "string" ? row.message : row.event, code: typeof row.code === "string" ? row.code : "",
    durationMs: typeof row.durationMs === "number" && Number.isFinite(row.durationMs) ? row.durationMs : 0,
    source: ["web", "api", "scheduler", "frontend"].includes(String(row.source)) ? row.source as LogEvent["source"] : "system",
    details: row.details && typeof row.details === "object" ? sanitizeDetails(row.details as Record<string, unknown>) : {},
  });
  return { ...event, id: row.id, timestamp: row.timestamp, requestId: safeIdentifier(row.requestId), instanceId: safeIdentifier(row.instanceId), appVersion: safeIdentifier(row.appVersion) };
}
interface Cursor { timestamp: number; id: string; cutoff: number; signature: string; }
function signature(filter: LogFilter): string { return createHash("sha256").update(JSON.stringify({ ...filter, to: 0 })).digest("hex"); }
export function queryLogs(filter: LogFilter, limit = 50, cursorText?: string | null): LogPage {
  flushLogs();
  limit = Math.min(10000, Math.max(1, Math.floor(limit)));
  let cursor: Cursor | undefined;
  if (cursorText) {
    if (cursorText.length > 1000) throw new Error("Invalid cursor");
    const value: unknown = JSON.parse(Buffer.from(cursorText, "base64url").toString());
    if (!value || typeof value !== "object") throw new Error("Invalid cursor");
    const c = value as Cursor;
    if (c.signature !== signature(filter) || !Number.isFinite(c.timestamp) || !Number.isFinite(c.cutoff) || c.cutoff > Date.now() + 60_000 || !safeIdentifier(c.id)) throw new Error("Invalid cursor");
    cursor = c;
  }
  const cutoff = Math.min(filter.to, cursor?.cutoff ?? filter.to);
  const effective = { ...filter, to: cutoff };
  const found = new Map<string, LogEvent>();
  const warnings = new Set<string>();
  const add = (event: LogEvent | null) => {
    if (!event || !matchesFilter(event, effective)) return;
    found.set(event.id, event);
  };
  let scanned = 0;
  try {
    for (const file of listLogFiles()) {
      const date = /-(\d{4}-\d{2}-\d{2})(?:-|\.)/.exec(file.name)?.[1];
      if (date && (Date.parse(date) > cutoff || Date.parse(date) + 86400_000 < filter.from)) continue;
      if (file.tier === "legacy") { warnings.add("legacy-files"); continue; }
      const index = readFileIndex(file);
      if (index && (index.last < filter.from || index.first > cutoff || (filter.category && !index.categories[filter.category]))) continue;
      if (scanned >= 32 * 1024 * 1024) { warnings.add("scan-limit"); break; }
      const tail = readLogTail(file, Math.min(8 * 1024 * 1024, 32 * 1024 * 1024 - scanned));
      scanned += Buffer.byteLength(tail.text);
      if (tail.partial) warnings.add("scan-limit");
      for (const line of tail.text.split("\n")) {
        if (!line) continue;
        if (line.length > 16 * 1024) { warnings.add("invalid-records"); continue; }
        try {
          const event = decodeLogEvent(JSON.parse(line));
          if (!event) warnings.add("invalid-records");
          add(event);
        } catch { warnings.add("invalid-records"); }
      }
    }
  } catch { warnings.add("files-unavailable"); }
  if (!filter.kind || filter.kind === "audit") {
    const rows = db.prepare(`SELECT id, user_id, action, target, created_at, event_json FROM audit_logs
      WHERE created_at >= ? AND created_at <= ? ${filter.actorId ? "AND user_id = ?" : ""}
      ${filter.event ? "AND action = ?" : ""}
      ORDER BY created_at DESC, id DESC LIMIT 20001`).all(filter.from, cutoff,
        ...(filter.actorId ? [filter.actorId] : []), ...(filter.event ? [filter.event] : [])) as { id: string; user_id: string; action: string; target: string; created_at: number; event_json: string }[];
    if (rows.length > 20000) warnings.add("audit-scan-limit");
    for (const row of rows.slice(0, 20000)) {
      let event: LogEvent | null = null;
      if (row.event_json) { try { event = decodeLogEvent(JSON.parse(row.event_json)); } catch { warnings.add("invalid-records"); } }
      if (!event) event = { ...createLogEvent({ category: categoryForEvent(row.action), event: row.action, kind: "audit", actorId: row.user_id,
        subjectId: row.target, outcome: "unknown", message: row.action }), id: row.id, timestamp: row.created_at, requestId: "", operationId: "", details: {} };
      add(event);
    }
  }
  const ordered = [...found.values()].sort((a, b) => b.timestamp - a.timestamp || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  // Count the same bounded snapshot on every page, before applying its cursor.
  const remaining = cursor ? ordered.filter(event => event.timestamp < cursor.timestamp || (event.timestamp === cursor.timestamp && event.id < cursor.id)) : ordered;
  const logs = remaining.slice(0, limit);
  const last = logs.at(-1);
  const nextCursor = remaining.length > limit && last ? Buffer.from(JSON.stringify({ timestamp: last.timestamp, id: last.id, cutoff, signature: signature(filter) })).toString("base64url") : null;
  return { logs, total: ordered.length, nextCursor, partial: warnings.size > 0, warnings: [...warnings] };
}
