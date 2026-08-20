import { NextResponse } from "next/server";
import { db, type UserRow } from "@/lib/db";
import { getSessionUser, hashPassword, verifyPassword, toPublicUser } from "@/lib/auth";

// PATCH /api/auth/profile - 当前登录用户自助修改个人资料（头像、显示名称、个人密码）
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const currentUserRow = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(user.id) as UserRow | undefined;

  if (!currentUserRow) {
    return NextResponse.json({ error: "用户账号不存在" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const avatar = body?.avatar !== undefined ? String(body.avatar).trim() : undefined;
  const displayName = body?.displayName !== undefined ? String(body.displayName).trim() : undefined;
  const email = body?.email !== undefined ? String(body.email).trim() : undefined;
  const bio = body?.bio !== undefined ? String(body.bio).trim() : undefined;
  const oldPassword = body?.oldPassword ? String(body.oldPassword) : undefined;
  const newPassword = body?.newPassword ? String(body.newPassword) : undefined;

  // 1. 头像格式校验（若有传入）
  if (avatar !== undefined && avatar !== "" && !/^(preset:|https?:\/\/|data:image\/)/i.test(avatar)) {
    return NextResponse.json(
      { error: "头像必须是内置头像、http(s) 链接或图片 data URL" },
      { status: 400 },
    );
  }

  // 2. 密码修改校验与更新（若有传入新密码）
  if (newPassword) {
    if (!oldPassword) {
      return NextResponse.json({ error: "修改密码时必须输入当前原密码" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "新密码长度不能少于 6 位" }, { status: 400 });
    }
    // 校验原密码
    const isOldPasswordCorrect = verifyPassword(oldPassword, currentUserRow.password_hash);
    if (!isOldPasswordCorrect) {
      return NextResponse.json({ error: "原密码验证错误，无法修改密码" }, { status: 400 });
    }
    // 哈希新密码并更新
    const newHash = hashPassword(newPassword);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, user.id);
  }

  // 3. 更新头像、显示名称、邮箱与座右铭
  if (avatar !== undefined) {
    db.prepare("UPDATE users SET avatar = ? WHERE id = ?").run(avatar, user.id);
  }
  if (displayName !== undefined && displayName !== "") {
    db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(displayName, user.id);
  }
  if (email !== undefined) {
    db.prepare("UPDATE users SET email = ? WHERE id = ?").run(email, user.id);
  }
  if (bio !== undefined) {
    db.prepare("UPDATE users SET bio = ? WHERE id = ?").run(bio, user.id);
  }

  const updatedRow = db
    .prepare(
      `SELECT id, username, password_hash, display_name, email, bio, role, avatar, created_at
       FROM users WHERE id = ?`,
    )
    .get(user.id) as unknown as UserRow;

  return NextResponse.json({
    success: true,
    user: toPublicUser(updatedRow),
    message: newPassword ? "个人资料与密码已成功更新" : "个人资料更新成功",
  });
}
