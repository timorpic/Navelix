import { localizedJson } from "@/lib/localized-json";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  countUnread,
  createNotification,
  deleteAllNotifications,
  listNotifications,
} from "@/lib/notification-store";

// GET /api/notifications - 当前用户的操作记录（最新在前）
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return localizedJson({ error: "未登录" }, { status: 401 });
  }

  return localizedJson({
    notifications: listNotifications(user.id),
    unreadCount: countUnread(user.id),
  });
}

// POST /api/notifications - 记录一条当前用户的操作通知，携带声明来源（source / tag）
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return localizedJson({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!String(body?.title ?? "").trim()) {
    return localizedJson({ error: "通知标题不能为空" }, { status: 400 });
  }

  return localizedJson(
    { notification: createNotification(user.id, body ?? {}) },
    { status: 201 },
  );
}

// DELETE /api/notifications - 清空当前用户全部操作记录
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) {
    return localizedJson({ error: "未登录" }, { status: 401 });
  }

  deleteAllNotifications(user.id);
  return localizedJson({ ok: true });
}
