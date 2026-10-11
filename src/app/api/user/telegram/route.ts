import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkCSRF } from "@/lib/csrf";
import { getTelegramConfigStatus, getTelegramSettings, saveTelegramSettings } from "@/lib/user-notifications";
import { sendTelegramMessage } from "@/lib/telegram";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  return NextResponse.json({ status: getTelegramConfigStatus(user.id), chatId: getTelegramSettings(user.id).chat_id });
}
export async function PUT(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const csrf = checkCSRF(req);
  if (!csrf.success) return NextResponse.json({ error: csrf.error }, { status: csrf.status || 403 });
  try {
    saveTelegramSettings(user.id, await req.json());
    return NextResponse.json({ success: true, status: getTelegramConfigStatus(user.id), chatId: getTelegramSettings(user.id).chat_id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "保存失败" }, { status: 400 });
  }
}
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const csrf = checkCSRF(req);
  if (!csrf.success) return NextResponse.json({ error: csrf.error }, { status: csrf.status || 403 });
  const ok = await sendTelegramMessage(user.id, "🔔 Navelix Telegram 通知测试：通知配置已生效。");
  return NextResponse.json(ok ? { success: true } : { error: "发送失败，请检查 Token、Chat ID 和总开关" }, { status: ok ? 200 : 400 });
}
