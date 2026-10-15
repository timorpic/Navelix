import { writeLog } from "./logging/events.ts";
export type LogLevel = "info" | "warn" | "error";
/** Compatibility for the existing migration/backup callers. Never copy error bodies. */
export function log(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
  writeLog({ category: /backup/i.test(message) ? "backup" : "runtime", event: /backup/i.test(message) ? "backup.failed" : "runtime.diagnostic", level,
    outcome: level === "error" ? "failed" : "unknown", message, details: fields });
}
export const logger = {
  info: (message: string, fields?: Record<string, unknown>) => log("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => log("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => log("error", message, fields),
};
