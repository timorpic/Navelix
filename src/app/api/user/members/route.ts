import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 返回当前系统中的全部成员列表（供任务指派与团队协同）
  const members = db
    .prepare(
      `SELECT id, username, display_name AS displayName, avatar, role
       FROM users
       ORDER BY created_at ASC`,
    )
    .all() as Array<{
    id: string;
    username: string;
    displayName: string;
    avatar: string;
    role: string;
  }>;

  return NextResponse.json({ members });
}
