import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { db } from "@/lib/db";

/** Public readiness probe: constant-size query only; deep diagnostics require an administrator. */
async function GETHandler() {
  try {
    const read = db.prepare("SELECT 1 AS ok").get();
    if (read?.ok !== 1) throw new Error("database-unavailable");
    return localizedJson({ status: "ok", db: "ok", time: Date.now() }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return localizedJson({ status: "degraded", db: "error", time: Date.now() }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
export const GET = withRequestLogging("/api/healthz", GETHandler);
