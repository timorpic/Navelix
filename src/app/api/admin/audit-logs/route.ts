import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { listAuditLogs } from "@/lib/audit";

// GET /api/admin/audit-logs - 后台「审计日志」页：分页查询全站审计记录（仅管理员）
async function GETHandler(req: NextRequest) {
  const adminUser = await requireAdmin(req);
  if (!adminUser) {
    return localizedJson({ error: "需要管理员权限" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limitRaw = Number(searchParams.get("limit"));
  const offsetRaw = Number(searchParams.get("offset"));
  const action = searchParams.get("action") || undefined;
  const q = searchParams.get("q") || undefined;

  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? limitRaw : 50;
  const offset = Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

  const { logs, total } = listAuditLogs({ limit, offset, action, q });

  return localizedJson({ logs, total });
}

export const GET = withRequestLogging("/api/admin/audit-logs", GETHandler);
