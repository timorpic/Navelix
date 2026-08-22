import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkCSRF } from "@/lib/csrf";
import {
  clearAnalyticsEvents,
  isAnalyticsEnabled,
  setAnalyticsEnabled,
} from "@/lib/analytics";

/**
 * GET/POST /api/admin/analytics/settings
 * 读取/修改「使用统计」总开关；POST body 支持 { enabled: boolean } 或 { action: "clear" }。
 * 仅管理员。
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "无权访问，仅管理员可查看使用统计设置" },
      { status: 403 },
    );
  }
  return NextResponse.json({ enabled: isAnalyticsEnabled() });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "无权访问，仅管理员可修改使用统计设置" },
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

  if (body.action === "clear") {
    clearAnalyticsEvents();
    return NextResponse.json({ success: true, enabled: isAnalyticsEnabled() });
  }

  if (typeof body.enabled === "boolean") {
    setAnalyticsEnabled(body.enabled);
  }

  return NextResponse.json({ success: true, enabled: isAnalyticsEnabled() });
}
