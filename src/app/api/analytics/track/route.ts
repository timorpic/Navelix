import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkCSRF } from "@/lib/csrf";
import { track } from "@/lib/analytics";

/**
 * POST /api/analytics/track
 * 客户端组件埋点端点（fire-and-forget，不阻塞 UI）。
 * 鉴权：有效 session 用户即可（无需 admin 角色）。
 * Body: { event: string, meta?: object }
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    // 未登录不记录——非访客场景
    return NextResponse.json({ success: false });
  }

  const csrfResult = checkCSRF(req);
  if (!csrfResult.success) {
    return NextResponse.json(
      { error: csrfResult.error || "CSRF 验证失败" },
      { status: csrfResult.status || 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.event !== "string" || !body.event) {
    return NextResponse.json({ success: false });
  }

  // fire-and-forget：track 内部已保证失败静默
  track(body.event, {
    userId: user.id,
    meta: body.meta,
  });

  return NextResponse.json({ success: true });
}