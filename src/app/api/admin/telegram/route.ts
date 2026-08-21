import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkCSRF } from "@/lib/csrf";
import {
  getTelegramConfigStatus,
  getTelegramChatId,
  setTelegramBotToken,
  setTelegramChatId,
  setTelegramEnabled,
  setTelegramNotifyBackupEnabled,
  setTelegramNotifySystemEnabled,
} from "@/lib/system-settings";
import { sendTelegramMessage } from "@/lib/telegram";

async function requireAdmin(req?: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdmin(req);
  if (!adminUser) {
    return NextResponse.json({ error: "无权访问，仅管理员可查看 Telegram 配置" }, { status: 403 });
  }
  return NextResponse.json({
    status: getTelegramConfigStatus(),
    chatId: getTelegramChatId(),
  });
}

export async function PUT(req: NextRequest) {
  const adminUser = await requireAdmin(req);
  if (!adminUser) {
    return NextResponse.json({ error: "无权访问，仅管理员可修改 Telegram 配置" }, { status: 403 });
  }

  const csrfResult = checkCSRF(req);
  if (!csrfResult.success) {
    return NextResponse.json(
      { error: csrfResult.error || "CSRF 验证失败" },
      { status: csrfResult.status || 403 },
    );
  }

  const body = await req.json().catch(() => ({}));

  // Bot Token：仅传入非空字符串时更新（留空=保持不变）
  if (typeof body.botToken === "string" && body.botToken.trim() !== "") {
    setTelegramBotToken(body.botToken);
  }
  if (typeof body.chatId === "string") {
    setTelegramChatId(body.chatId);
  }
  if (typeof body.enabled === "boolean") {
    setTelegramEnabled(body.enabled);
  }
  if (typeof body.notifyBackup === "boolean") {
    setTelegramNotifyBackupEnabled(body.notifyBackup);
  }
  if (typeof body.notifySystem === "boolean") {
    setTelegramNotifySystemEnabled(body.notifySystem);
  }

  return NextResponse.json({
    success: true,
    status: getTelegramConfigStatus(),
    chatId: getTelegramChatId(),
  });
}

/** 发送测试消息到 Telegram，验证配置是否生效 */
export async function POST(req: NextRequest) {
  const adminUser = await requireAdmin(req);
  if (!adminUser) {
    return NextResponse.json({ error: "无权访问，仅管理员可测试 Telegram 配置" }, { status: 403 });
  }

  const csrfResult = checkCSRF(req);
  if (!csrfResult.success) {
    return NextResponse.json(
      { error: csrfResult.error || "CSRF 验证失败" },
      { status: csrfResult.status || 403 },
    );
  }

  const ok = await sendTelegramMessage(
    `🔔 Navelix Telegram 通知测试\n\n如果收到此消息，说明通知配置已生效。\n${new Date().toLocaleString("zh-CN")}`,
  );
  if (!ok) {
    return NextResponse.json(
      { error: "发送失败。请检查 Bot Token、Chat ID 是否正确，并确认 Telegram 总开关已开启。" },
      { status: 400 },
    );
  }
  return NextResponse.json({ success: true, message: "测试消息已发送，请检查 Telegram" });
}
