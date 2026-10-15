import { requireAdmin } from "@/lib/auth";
import { localizedJson } from "@/lib/localized-json";
import { parseLogFilter, queryLogs } from "@/lib/logging/query";
import type { NextRequest } from "next/server";
export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return localizedJson({ error: "需要管理员权限" }, { status: 403 });
  try {
    const params = req.nextUrl.searchParams;
    const limit = params.has("limit") ? Number(params.get("limit")) : 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error("Invalid page size");
    return localizedJson(queryLogs(parseLogFilter(params), limit, params.get("cursor")));
  } catch { return localizedJson({ error: "日志查询失败，请检查筛选条件或缩小时间范围" }, { status: 400 }); }
}
