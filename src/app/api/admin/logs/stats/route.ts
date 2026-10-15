import { summarizeLogs } from "@/lib/logging/statistics";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { localizedJson } from "@/lib/localized-json";
import { logStoreHealth } from "@/lib/logging/store";
import { parseLogFilter, queryLogs } from "@/lib/logging/query";
import type { NextRequest } from "next/server";
export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return localizedJson({ error: "需要管理员权限" }, { status: 403 });
  const page = queryLogs(parseLogFilter(new URLSearchParams({ from: String(Date.now() - 86400_000) })), 10000);
  return localizedJson({ health: logStoreHealth(), auditCount: Number(db.prepare("SELECT COUNT(*) AS c FROM audit_logs").get()?.c ?? 0),
    ...summarizeLogs(page.logs),
    partial: page.partial || Boolean(page.nextCursor) });
}
