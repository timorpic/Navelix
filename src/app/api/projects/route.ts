import { NextRequest, NextResponse } from "next/server";
import { db, SESSION_COOKIE } from "@/lib/db";
import { createHash } from "node:crypto";
import type { Project } from "@/types";

function getUserIdFromSession(req: NextRequest): string | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value || "";
  if (!token) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const session = db
    .prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?")
    .get(tokenHash) as { user_id: string; expires_at: number } | undefined;
  if (!session || session.expires_at < Date.now()) return null;
  return session.user_id;
}

export async function GET(req: NextRequest) {
  const userId = getUserIdFromSession(req);
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const rows = db
    .prepare("SELECT id, name, status, status_color, url, sort_order FROM projects WHERE user_id = ? ORDER BY sort_order ASC")
    .all(userId) as { id: string; name: string; status: string; status_color: string; url: string; sort_order: number }[];
  return NextResponse.json({
    projects: rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status || "进行中",
      color: r.status_color || "#00C776",
      statusColor: r.status_color || "#00C776",
      url: r.url || "",
      sortOrder: r.sort_order,
    })),
  });
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromSession(req);
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ error: "项目名不能为空" }, { status: 400 });
    const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const status = String(body.status || "进行中").trim();
    const color = String(body.color || body.statusColor || "#00C776").trim();
    const url = String(body.url || "").trim();
    const maxSort = db
      .prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM projects WHERE user_id = ?")
      .get(userId) as { m: number };
    db.prepare("INSERT INTO projects (id, user_id, name, status, status_color, url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, userId, name, status, color, url, maxSort.m + 1);
    return NextResponse.json({
      success: true,
      project: { id, name, status, color, statusColor: color, url, sortOrder: maxSort.m + 1 },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "创建失败" }, { status: 500 });
  }
}