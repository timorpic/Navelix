import { randomUUID } from "node:crypto";
import { cleanupAuditRetention } from "../logging/management.ts";
import { cleanupLogFiles, logStoreHealth, flushLogs } from "../logging/store.ts";
import { writeLog, flushLogGroups } from "../logging/events.ts";
import { logContext } from "../logging/context.ts";
export function runLogMaintenance(): void {
  logContext.run({ requestId: "", operationId: randomUUID(), source: "scheduler", category: "runtime" }, () => {
    try {
      flushLogGroups(); flushLogs();
      const files = cleanupLogFiles(); const auditCount = cleanupAuditRetention();
      const health = logStoreHealth();
      if (files.removed || auditCount) writeLog({ category: "system", event: "logs.maintenance.completed", details: { ...files, auditCount } });
      if (!health.readable || health.lastErrorAt > health.successfulWriteAt) writeLog({ category: "runtime", event: "logs.storage.failed", level: "error", outcome: "failed" });
    } catch { writeLog({ category: "runtime", event: "logs.maintenance.failed", level: "error", outcome: "failed" }); }
  });
}
