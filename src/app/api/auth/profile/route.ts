import { NextResponse } from "next/server";
import { db, type UserRow } from "@/lib/db";
import { getSessionUser, toPublicUser } from "@/lib/auth";

// PATCH /api/auth/profile - 当前用户自助修改个人资料（头像）
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const avatar = String(body?.avatar ?? "").trim();

  if (
    avatar &&
    !/^(preset:|https?:\/\/|data:image\/)/i.test(avatar)
  ) {
    return NextResponse.json(
      { error: "头像必须是内置头像、http(s) 链接或图片 data URL" },
      { status: 400 },
    );
  }

  db.prepare("UPDATE users SET avatar = ? WHERE id = ?").run(avatar, user.id);

  const row = db
    .prepare(
      `SELECT id, username, password_hash, display_name, role, avatar, created_at
       FROM users WHERE id = ?`,
    )
    .get(user.id) as unknown as UserRow;

  return NextResponse.json({ user: toPublicUser(row) });
}
