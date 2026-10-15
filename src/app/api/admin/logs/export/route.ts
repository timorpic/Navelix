import { requireAdmin } from "@/lib/auth";
import { localizedJson } from "@/lib/localized-json";
import { parseLogFilter, queryLogs } from "@/lib/logging/query";
import { recordAuditLog } from "@/lib/audit";
import type { NextRequest } from "next/server";
function csvCell(value: string | number): string { const text = String(value); return `"${(/^[\s]*[=+@-]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`; }
export async function POST(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return localizedJson({ error: "需要管理员权限" }, { status: 403 });
  try {
    const params = req.nextUrl.searchParams;
    const page = queryLogs(parseLogFilter(params), 10000);
    if (page.partial || page.nextCursor) return localizedJson({ error: "结果不完整或超过导出上限，请缩小时间范围" }, { status: 413 });
    const csv = params.get("format") === "csv";
    const body = csv ? ["time,category,event,actorId,outcome,level,requestId,operationId,durationMs", ...page.logs.map(e => [new Date(e.timestamp).toISOString(), e.category, e.event, e.actorId, e.outcome, e.level, e.requestId, e.operationId, e.durationMs].map(csvCell).join(","))].join("\n") : page.logs.map(e => JSON.stringify(e)).join("\n");
    recordAuditLog({ userId: user.id, action: "logs.exported", details: `count=${page.logs.length}` });
    return new Response(body, { headers: { "Content-Type": csv ? "text/csv; charset=utf-8" : "application/x-ndjson", "Content-Disposition": `attachment; filename="navelix-logs.${csv ? "csv" : "jsonl"}"`, "Cache-Control": "no-store" } });
  } catch { return localizedJson({ error: "日志导出失败" }, { status: 400 }); }
}
