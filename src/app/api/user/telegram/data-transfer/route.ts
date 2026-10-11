import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkCSRF } from "@/lib/csrf";
import { sendUserTelegramNotification } from "@/lib/telegram";

/** Browser export completion; no caller-supplied message, channel or recipient accepted. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const csrf = checkCSRF(req);
  if (!csrf.success) return NextResponse.json({ error: csrf.error }, { status: csrf.status || 403 });
  try {
    const input: unknown = await req.json();
    if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some(key => key !== "action") || !("action" in input) || input.action !== "export") {
      return NextResponse.json({ error: "无效操作" }, { status: 400 });
    }
    await sendUserTelegramNotification(user.id, "📦 Navelix：个人 JSON 导出文件已生成。", "dataTransfer");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "无效请求" }, { status: 400 });
  }
}
