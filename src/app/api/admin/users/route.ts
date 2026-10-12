import { localizedJson } from "@/lib/localized-json";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { checkCSRF, hashPassword, requireAdmin } from "@/lib/auth";
import { adminCount, deleteUserCascade, updateUser, UserUpdateError } from "@/lib/admin-users";

// GET: Fetch list of all registered users
export async function GET() {
  const adminUser = await requireAdmin();
  if (!adminUser) {
    return localizedJson({ error: "Unauthorized access" }, { status: 403 });
  }

  const users = db
    .prepare(
      `SELECT id, username, display_name AS displayName, role, disabled, avatar, created_at AS createdAt
       FROM users
       ORDER BY created_at DESC`
    )
    .all();

  return localizedJson({ users: users.map(user => ({ ...user, disabled: user.disabled === 1 })) });
}

// POST: Create a new user from Admin Console
export async function POST(req: Request) {
  const adminUser = await requireAdmin(req);
  if (!adminUser) {
    return localizedJson({ error: "Unauthorized access" }, { status: 403 });
  }
  if (!checkCSRF(req).success) {
    return localizedJson({ error: "CSRF 验证失败" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const displayName = String(body?.displayName ?? "").trim();
  const role = body?.role === "admin" ? "admin" : "user";
  const avatar = String(body?.avatar ?? "").trim();

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return localizedJson(
      { error: "Username must be 3-20 characters (letters, numbers, underscore)" },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return localizedJson(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }
  if (avatar && !/^(preset:|https?:\/\/|data:image\/)/i.test(avatar)) {
    return localizedJson(
      { error: "Avatar must be an http(s) URL or an image data URL" },
      { status: 400 }
    );
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username);
  if (existing) {
    return localizedJson(
      { error: "Username already taken" },
      { status: 409 }
    );
  }

  const id = randomBytes(16).toString("hex");
  db.prepare(
    "INSERT INTO users (id, username, password_hash, display_name, role, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    username,
    hashPassword(password),
    displayName || username,
    role,
    avatar,
    Date.now()
  );

  return localizedJson({ message: "User created successfully", userId: id }, { status: 201 });
}

// PATCH: Update user role / password / display name
export async function PATCH(req: Request) {
  const adminUser = await requireAdmin(req);
  if (!adminUser) {
    return localizedJson({ error: "Unauthorized access" }, { status: 403 });
  }
  // checkCSRF 返回对象，必须检查 .success（对象本身恒为 truthy）
  if (!checkCSRF(req).success) {
    return localizedJson({ error: "CSRF 验证失败" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    disabled?: boolean;
    id?: string;
    role?: string;
    username?: string;
    displayName?: string;
    password?: string;
    avatar?: string;
  } | null;
  const { id, role, username, displayName, password, avatar, disabled } = body || {};

  if (!id) {
    return localizedJson({ error: "User ID required" }, { status: 400 });
  }

  const targetUser = db
    .prepare("SELECT id, username, role FROM users WHERE id = ?")
    .get(id) as { id: string; username: string; role: string } | undefined;

  if (!targetUser) {
    return localizedJson({ error: "User not found" }, { status: 404 });
  }

  // 密码长度在路由层校验（哈希前的明文检查），其余校验在 updateUser 事务内进行
  if (typeof password === "string" && password.length > 0 && password.length < 6) {
    return localizedJson(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  try {
    // 单事务应用全部修改；校验失败整体回滚（见 lib/admin-users.ts）
    updateUser(
      id,
      {
        disabled,
        role,
        username,
        displayName,
        avatar,
        passwordHash:
          typeof password === "string" && password.length > 0
            ? hashPassword(password)
            : undefined,
      },
      { actorId: adminUser.id, targetRole: targetUser.role },
    );
  } catch (err) {
    if (err instanceof UserUpdateError) {
      // 用户名冲突沿用既有的 409 语义
      const status = err.message === "Username already taken" ? 409 : 400;
      return localizedJson({ error: err.message }, { status });
    }
    throw err;
  }

  return localizedJson({ message: "User updated successfully" });
}

// DELETE: Remove a user account
export async function DELETE(req: Request) {
  const adminUser = await requireAdmin(req);
  if (!adminUser) {
    return localizedJson({ error: "Unauthorized access" }, { status: 403 });
  }
  if (!checkCSRF(req).success) {
    return localizedJson({ error: "CSRF 验证失败" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return localizedJson({ error: "User ID required" }, { status: 400 });
  }

  if (id === adminUser.id) {
    return localizedJson(
      { error: "You cannot delete your own logged-in account" },
      { status: 400 }
    );
  }

  const targetUser = db
    .prepare("SELECT id, role, disabled FROM users WHERE id = ?")
    .get(id) as { id: string; role: string; disabled: number } | undefined;
  if (!targetUser) {
    return localizedJson({ error: "User not found" }, { status: 404 });
  }
  if (targetUser.role === "admin" && !targetUser.disabled && adminCount() <= 1) {
    return localizedJson(
      { error: "Cannot delete the last remaining admin account" },
      { status: 400 }
    );
  }

  // 单事务级联删除（见 lib/admin-users.ts）；audit_logs 刻意保留为合规证据
  try { deleteUserCascade(id); }
  catch (error) {
    if (error instanceof UserUpdateError) return localizedJson({ error: error.message }, { status: 400 });
    throw error;
  }

  return localizedJson({ message: "User deleted successfully" });
}
