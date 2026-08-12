import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// POST /api/notifications/read - 将当前用户全部通知标记为已读
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(user.id);
  return NextResponse.json({ ok: true });
}
