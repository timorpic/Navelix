import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkCSRF } from "@/lib/csrf";
import {
  buildReportPayload,
  getAnalyticsReportEndpoint,
  getLastReportWeek,
  isAnalyticsReportEnabled,
  maybeRunWeeklyReport,
  setAnalyticsReportEnabled,
  currentWeekStart,
} from "@/lib/analytics-report";

/**
 * GET /api/admin/analytics/report
 * 读取「帮助改进 Navelix」上报状态 + 将发送的数据预览（仅管理员）。
 * POST body: { enabled?: boolean } | { action: "send_now" } | { action: "preview" }
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "无权访问，仅管理员可查看上报设置" },
      { status: 403 },
    );
  }

  const payload = await buildReportPayload();
  return NextResponse.json({
    enabled: isAnalyticsReportEnabled(),
    endpoint: getAnalyticsReportEndpoint(),
    endpointConfigured: Boolean(getAnalyticsReportEndpoint()),
    lastReportWeek: getLastReportWeek(),
    currentWeekStart: currentWeekStart(),
    // 预览将发送的内容（不含任何敏感字段，仅聚合计数）
    preview: payload,
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "无权访问，仅管理员可修改上报设置" },
      { status: 403 },
    );
  }

  const csrfResult = checkCSRF(req);
  if (!csrfResult.success) {
    return NextResponse.json(
      { error: csrfResult.error || "CSRF 验证失败" },
      { status: csrfResult.status || 403 },
    );
  }

  const body = await req.json().catch(() => ({}));

  if (body.action === "send_now") {
    const result = await maybeRunWeeklyReport();
    return NextResponse.json({ success: true, result });
  }

  if (typeof body.enabled === "boolean") {
    setAnalyticsReportEnabled(body.enabled);
  }

  return NextResponse.json({
    success: true,
    enabled: isAnalyticsReportEnabled(),
    endpoint: getAnalyticsReportEndpoint(),
    lastReportWeek: getLastReportWeek(),
  });
}
