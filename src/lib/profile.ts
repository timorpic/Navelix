import { db, type UserRow } from "./db.ts";
import { hashPassword, verifyPassword } from "./auth.ts";

/**
 * 个人资料自助修改的领域逻辑（下沉自 api/auth/profile/route.ts）。
 *
 * 下沉动机：该 handler 把「改密码」与「改资料」写成两组独立 UPDATE，
 * **无事务包裹** —— 密码已改而资料更新失败时，用户会处于半改状态，
 * 且失败响应会让人以为什么都没变。事务边界属于领域不变量。
 */

export interface ProfileUpdateInput {
  avatar?: unknown;
  displayName?: unknown;
  email?: unknown;
  bio?: unknown;
  oldPassword?: unknown;
  newPassword?: unknown;
}

export type ProfileUpdateResult =
  | { ok: true; passwordChanged: boolean }
  | { ok: false; error: string };

const AVATAR_PATTERN = /^(preset:|https?:\/\/|data:image\/)/i;

/**
 * 更新个人资料（可选同时改密码），单事务全成或全败。
 *
 * 校验顺序与原实现一致：先头像格式，再密码（缺原密码 → 长度 → 原密码正确性），
 * 全部通过后才开始写库 —— 因此校验失败时不会产生任何副作用。
 */
export function updateProfile(
  userId: string,
  input: ProfileUpdateInput,
): ProfileUpdateResult {
  const avatar = input.avatar !== undefined ? String(input.avatar).trim() : undefined;
  const displayName =
    input.displayName !== undefined ? String(input.displayName).trim() : undefined;
  const email = input.email !== undefined ? String(input.email).trim() : undefined;
  const bio = input.bio !== undefined ? String(input.bio).trim() : undefined;
  const oldPassword = input.oldPassword ? String(input.oldPassword) : undefined;
  const newPassword = input.newPassword ? String(input.newPassword) : undefined;

  const currentUserRow = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(userId) as UserRow | undefined;

  if (!currentUserRow) {
    return { ok: false, error: "用户账号不存在" };
  }

  // 1. 头像格式校验（若有传入）
  if (avatar !== undefined && avatar !== "" && !AVATAR_PATTERN.test(avatar)) {
    return { ok: false, error: "头像必须是内置头像、http(s) 链接或图片 data URL" };
  }

  // 2. 密码修改校验（若有传入新密码）
  let newHash: string | null = null;
  if (newPassword) {
    if (!oldPassword) {
      return { ok: false, error: "修改密码时必须输入当前原密码" };
    }
    if (newPassword.length < 6) {
      return { ok: false, error: "新密码长度不能少于 6 位" };
    }
    if (!verifyPassword(oldPassword, currentUserRow.password_hash)) {
      return { ok: false, error: "原密码验证错误，无法修改密码" };
    }
    newHash = hashPassword(newPassword);
  }

  // 3. 全部校验通过后一次性写入
  db.exec("BEGIN IMMEDIATE;");
  try {
    if (newHash !== null) {
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, userId);
    }
    if (avatar !== undefined) {
      db.prepare("UPDATE users SET avatar = ? WHERE id = ?").run(avatar, userId);
    }
    // 显示名称刻意不接受空串：清空昵称会让界面无从称呼该用户
    if (displayName !== undefined && displayName !== "") {
      db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(displayName, userId);
    }
    if (email !== undefined) {
      db.prepare("UPDATE users SET email = ? WHERE id = ?").run(email, userId);
    }
    if (bio !== undefined) {
      db.prepare("UPDATE users SET bio = ? WHERE id = ?").run(bio, userId);
    }
    db.exec("COMMIT;");
  } catch (e) {
    db.exec("ROLLBACK;");
    throw e;
  }

  return { ok: true, passwordChanged: newHash !== null };
}

/** 读取用户行（改资料后回传最新状态）。 */
export function getUserRow(userId: string): UserRow | undefined {
  return db
    .prepare(
      `SELECT id, username, password_hash, display_name, email, bio, role, avatar, created_at
       FROM users WHERE id = ?`,
    )
    .get(userId) as unknown as UserRow | undefined;
}
