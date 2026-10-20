/** Do not serialize arbitrary request, response, error, or business objects. */
const SAFE_FIELDS = new Set([
  "status", "count", "attempt", "attempts", "bytes", "removed", "releasedBytes", "reason", "errorName",
  "retryAfterMs", "durationMs", "fieldNames", "changes", "items", "truncated", "scannedBytes",
  "code", "method", "route", "channel", "provider", "model", "inputTokens", "outputTokens",
  "totalTokens", "version", "previousVersion", "result", "firstSeen", "lastSeen", "occurrences",
  "dropped", "failed", "succeeded", "skipped", "exhausted", "retentionDays", "files", "auditCount",
]);
const SAFE_CONFIG_VALUES = new Set([
  "allowPublicAccess", "allowRegistration", "showProMenus", "theme", "language", "maxWidth",
  "sidebarDefaultState", "level", "auditRetentionDays", "runtimeRetentionDays",
  "businessRetentionDays", "maxFileBytes", "maxTotalBytes", "frontendEnabled", "alertsEnabled",
]);
const SENSITIVE = /password|passwd|secret|token|cookie|authorization|api.?key|credential|bot.?token|chat.?id|license|prompt|content|body|script|signature/i;
export function safeText(value: string, max = 512): string {
  return value.replace(/[\r\n\t\u0000-\u001f]/g, " ")
    .replace(/https?:\/\/[^\s<>"']+/gi, "[URL]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\b(?:nvx_live_|sk-|eyJ)[A-Za-z0-9_.-]+/g, "[REDACTED]")
    .replace(/(?:password|secret|token|api[_-]?key|authorization|cookie)\s*[:=]\s*[^\s,;]+/gi, "[REDACTED]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]")
    .slice(0, max);
}
export function safeIdentifier(value: unknown, max = 100): string {
  return typeof value === "string" && /^[a-zA-Z0-9_.:/[\]-]+$/.test(value) ? safeText(value, max) : "";
}
function cleanValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[TRUNCATED]";
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return safeText(value, 256);
  if (Array.isArray(value)) return value.slice(0, 20).map(item => cleanValue(item, depth + 1));
  // Nested arbitrary objects are deliberately omitted, not recursively expanded.
  return "[OMITTED]";
}
export function sanitizeChanges(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).flatMap(item => {
    if (!item || typeof item !== "object" || !("field" in item) || typeof item.field !== "string") return [];
    const change = item as Record<string, unknown>;
    const field = safeIdentifier(change.field);
    if (!field) return [];
    const visible = SAFE_CONFIG_VALUES.has(field) && !SENSITIVE.test(field);
    return [{ field, from: visible ? cleanValue(change.from) : "[REDACTED]", to: visible ? cleanValue(change.to) : "[UPDATED]" }];
  });
}
export function sanitizeDetails(fields: Record<string, unknown> = {}): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields).slice(0, 60)) {
    if (!SAFE_FIELDS.has(key) || SENSITIVE.test(key)) continue;
    result[key] = key === "changes" ? sanitizeChanges(value) : cleanValue(value);
  }
  return result;
}
