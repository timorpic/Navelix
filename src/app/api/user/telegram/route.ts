import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkCSRF } from "@/lib/csrf";
import { getTelegramConfigStatus, getTelegramSettings, saveTelegramSettings } from "@/lib/user-notifications";
import { sendTelegramMessage } from "@/lib/telegram";

async function GETHandler(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });
  return localizedJson({ status: getTelegramConfigStatus(user.id), chatId: getTelegramSettings(user.id).chat_id });
}
async function PUTHandler(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });
  const csrf = checkCSRF(req);
  if (!csrf.success) return localizedJson({ error: csrf.error }, { status: csrf.status || 403 });
  try {
    saveTelegramSettings(user.id, await req.json());
    return localizedJson({ success: true, status: getTelegramConfigStatus(user.id), chatId: getTelegramSettings(user.id).chat_id });
  } catch (error) {
    return localizedJson({ error: error instanceof Error ? error.message : "保存失败" }, { status: 400 });
  }
}
async function POSTHandler(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });
  const csrf = checkCSRF(req);
  if (!csrf.success) return localizedJson({ error: csrf.error }, { status: csrf.status || 403 });
  const ok = await sendTelegramMessage(user.id, "🔔 Navelix Telegram 通知测试：通知配置已生效。");
  return localizedJson(ok ? { success: true } : { error: "发送失败，请检查 Token、Chat ID 和总开关" }, { status: ok ? 200 : 400 });
}

export const GET = withRequestLogging("/api/user/telegram", GETHandler);
export const PUT = withRequestLogging("/api/user/telegram", PUTHandler);
export const POST = withRequestLogging("/api/user/telegram", POSTHandler);
