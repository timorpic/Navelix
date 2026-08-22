import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAnalyticsSummary } from "@/lib/analytics";

/**
 * GET /api/admin/analytics/summary
 * 管理后台「使用统计」汇总数据（仅管理员）。
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "无权访问，仅管理员可查看使用统计" },
      { status: 403 },
    );
  }
  return NextResponse.json(getAnalyticsSummary());
}
