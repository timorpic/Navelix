import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkCSRF, getSessionUser, hashPassword } from "@/lib/auth";

function adminCount(): number {
  return (
    db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'").get() as {
      c: number;
    }
  ).c;
}

// Middleware helper: check if session user is Admin
async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return false;
  }
  return user;
}

// GET: Fetch list of all registered users
export async function GET() {
  const adminUser = await requireAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
  }

  const users = db
    .prepare(
      `SELECT id, username, display_name AS displayName, role, avatar, created_at AS createdAt
       FROM users
       ORDER BY created_at DESC`
    )
    .all();

  return NextResponse.json({ users });
}

// POST: Create a new user from Admin Console
export async function POST(req: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
  }
  if (!checkCSRF(req).success) {
    return NextResponse.json({ error: "CSRF 验证失败" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const displayName = String(body?.displayName ?? "").trim();
  const role = body?.role === "admin" ? "admin" : "user";
  const avatar = String(body?.avatar ?? "").trim();

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-20 characters (letters, numbers, underscore)" },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }
  if (avatar && !/^(preset:|https?:\/\/|data:image\/)/i.test(avatar)) {
    return NextResponse.json(
      { error: "Avatar must be an http(s) URL or an image data URL" },
      { status: 400 }
    );
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username);
  if (existing) {
    return NextResponse.json(
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

  return NextResponse.json({ message: "User created successfully", userId: id }, { status: 201 });
}

// PATCH: Update user role / password / display name
export async function PATCH(req: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
  }
  // checkCSRF 返回对象，必须检查 .success（对象本身恒为 truthy）
  if (!checkCSRF(req).success) {
    return NextResponse.json({ error: "CSRF 验证失败" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    id?: string;
    role?: string;
    username?: string;
    displayName?: string;
    password?: string;
    avatar?: string;
  } | null;
  const { id, role, username, displayName, password, avatar } = body || {};

  if (!id) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }

  const targetUser = db
    .prepare("SELECT id, username, role FROM users WHERE id = ?")
    .get(id) as { id: string; username: string; role: string } | undefined;

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Prevent demoting the last admin or demoting one's own logged-in account.
  if (targetUser.id === adminUser.id && role === "user") {
    return NextResponse.json(
      { error: "You cannot demote your own admin account" },
      { status: 400 }
    );
  }

  if (typeof username === "string") {
    const newUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(newUsername)) {
      return NextResponse.json(
        { error: "Username must be 3-20 characters (letters, numbers, underscore)" },
        { status: 400 }
      );
    }
    const existing = db
      .prepare("SELECT id FROM users WHERE username = ? AND id != ?")
      .get(newUsername, id);
    if (existing) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }
    db.prepare("UPDATE users SET username = ? WHERE id = ?").run(
      newUsername,
      id
    );
  }
  if (targetUser.role === "admin" && role === "user" && adminCount() <= 1) {
    return NextResponse.json(
      { error: "Cannot demote the last remaining admin account" },
      { status: 400 }
    );
  }

  if (role && (role === "admin" || role === "user")) {
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
  }

  if (typeof displayName === "string") {
    db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(
      displayName.trim(),
      id
    );
  }

  if (typeof avatar === "string") {
    const trimmedAvatar = avatar.trim();
    if (
      trimmedAvatar &&
      !/^(preset:|https?:\/\/|data:image\/)/i.test(trimmedAvatar)
    ) {
      return NextResponse.json(
        { error: "Avatar must be an http(s) URL or an image data URL" },
        { status: 400 }
      );
    }
    db.prepare("UPDATE users SET avatar = ? WHERE id = ?").run(
      trimmedAvatar,
      id
    );
  }

  if (typeof password === "string" && password.length > 0) {
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
      hashPassword(password),
      id
    );
  }

  return NextResponse.json({ message: "User updated successfully" });
}

// DELETE: Remove a user account
export async function DELETE(req: Request) {
  const adminUser = await requireAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
  }
  if (!checkCSRF(req).success) {
    return NextResponse.json({ error: "CSRF 验证失败" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }

  if (id === adminUser.id) {
    return NextResponse.json(
      { error: "You cannot delete your own logged-in account" },
      { status: 400 }
    );
  }

  const targetUser = db
    .prepare("SELECT id, role FROM users WHERE id = ?")
    .get(id) as { id: string; role: string } | undefined;
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (targetUser.role === "admin" && adminCount() <= 1) {
    return NextResponse.json(
      { error: "Cannot delete the last remaining admin account" },
      { status: 400 }
    );
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM user_categories WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM user_links WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM user_configs WHERE user_id = ?").run(id);

  return NextResponse.json({ message: "User deleted successfully" });
}
