import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db, SESSION_COOKIE } from "@/lib/db";
import { createSession, hashPassword, toPublicUser } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "")
    .trim()
    .toLowerCase();
  const password = String(body?.password ?? "");
  const displayName = String(body?.displayName ?? "").trim();

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-20 characters (letters, numbers, underscore)" },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 },
    );
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username);
  if (existing) {
    return NextResponse.json(
      { error: "Username already taken" },
      { status: 409 },
    );
  }

  const count = (
    db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }
  ).c;
  const role = count === 0 ? "admin" : "user";
  const id = randomBytes(16).toString("hex");

  db.prepare(
    "INSERT INTO users (id, username, password_hash, display_name, role, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    username,
    hashPassword(password),
    displayName || username,
    role,
    "",
    Date.now(),
  );

  const token = await createSession(id);
  const user = toPublicUser({
    id,
    username,
    password_hash: "",
    display_name: displayName || username,
    role,
    avatar: "",
    created_at: Date.now(),
  });

  const res = NextResponse.json({ user }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NAVELIX_COOKIE_SECURE === "true",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}
