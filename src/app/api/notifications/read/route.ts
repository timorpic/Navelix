import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { markAllRead } from "@/lib/notification-store";

// POST /api/notifications/read - 将当前用户全部通知标记为已读
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  markAllRead(user.id);
  return NextResponse.json({ ok: true });
}
