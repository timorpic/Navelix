import { randomUUID } from "node:crypto";
import { logContext } from "./context.ts";
import { safeIdentifier, safeText, sanitizeDetails } from "./redact.ts";
import { readLogSettings } from "./settings.ts";
import { enqueueLog, instanceId } from "./store.ts";
import type { LogEvent, LogInput } from "./types.ts";
import { getBuildInfo } from "../build-info.ts";
const APP_VERSION = getBuildInfo().version;

export function createLogEvent(input: LogInput): LogEvent {
  const context = logContext.getStore();
  const actorId = safeIdentifier(input.actorId ?? context?.actorId);
  const details = sanitizeDetails(input.details);
  const boundedDetails = JSON.stringify(details).length > 8000 ? { truncated: true, fieldNames: Object.keys(details) } : details;
  return {
    id: randomUUID(), schemaVersion: 1, timestamp: Date.now(), category: input.category,
    module: safeIdentifier(input.module ?? input.event.split(".").slice(0, 2).join(".")),
    event: safeIdentifier(input.event), kind: input.kind ?? "runtime", level: input.level ?? "info",
    outcome: input.outcome ?? (input.level === "error" ? "failed" : "succeeded"), actorType: input.actorType ?? (actorId ? "user" : context ? "anonymous" : "system"),
    actorId, subjectType: safeIdentifier(input.subjectType), subjectId: safeIdentifier(input.subjectId),
    requestId: safeIdentifier(context?.requestId), operationId: safeIdentifier(input.operationId ?? context?.operationId),
    parentId: safeIdentifier(input.parentId), message: safeText(input.message ?? input.event), code: safeIdentifier(input.code),
    durationMs: Math.max(0, Math.round(input.durationMs ?? 0)), source: input.source ?? context?.source ?? "system",
    appVersion: APP_VERSION, instanceId, details: boundedDetails,
  };
}
const groups = new Map<string, { until: number; count: number; first: number; event: LogEvent }>();
let alertSink: ((event: LogEvent) => void) | undefined;
export function setLogAlertSink(sink: (event: LogEvent) => void): void { alertSink = sink; }
export function writeLog(input: LogInput): LogEvent | null {
  const settings = readLogSettings();
  if (input.kind !== "audit" && !settings.categories[input.category]) return null;
  if (input.level === "debug" && settings.level !== "debug") return null;
  const event = createLogEvent(input);
  if (settings.alertsEnabled) { try { alertSink?.(event); } catch { /* Never affect business. */ } }
  // Repeated failures retain first/last/count without storing attacker-controlled keys.
  if (event.level === "error" || event.level === "warn") {
    const key = `${event.category}:${event.event}:${event.code}:${event.actorId}`;
    const existing = groups.get(key);
    if (existing && existing.until > Date.now() && event.kind !== "audit") {
      existing.count++;
      return event;
    }
    if (existing) event.details = { ...event.details, occurrences: existing.count + 1, firstSeen: existing.first, lastSeen: Date.now() };
    if (groups.size > 1000) groups.clear();
    groups.set(key, { until: Date.now() + 60_000, count: 0, first: Date.now(), event });
  }
  const line = JSON.stringify(event);
  if (event.level === "error") console.error(line);
  else if (event.level === "warn") console.warn(line);
  else console.log(line);
  enqueueLog(event);
  return event;
}

/** Emit suppressed counts even when the burst stops; never re-enter grouping or alerts. */
export function flushLogGroups(now = Date.now()): void {
  for (const [key, group] of groups) {
    if (group.until > now) continue;
    groups.delete(key);
    if (!group.count) continue;
    const event = { ...group.event, id: randomUUID(), timestamp: now, details: { ...group.event.details, occurrences: group.count, firstSeen: group.first, lastSeen: now } };
    console.warn(JSON.stringify(event)); enqueueLog(event);
  }
}
