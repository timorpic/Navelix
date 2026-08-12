import { NextRequest, NextResponse } from "next/server";
import { db, SESSION_COOKIE } from "@/lib/db";
import { createHash } from "node:crypto";

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = getUserIdFromSession(req);
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const fields: string[] = [];
  const vals: (string | number)[] = [];
  if (body.name !== undefined) { fields.push("name = ?"); vals.push(String(body.name).trim()); }
  if (body.status !== undefined) { fields.push("status = ?"); vals.push(String(body.status).trim()); }
  if (body.color !== undefined || body.statusColor !== undefined) {
    fields.push("status_color = ?");
    vals.push(String(body.color || body.statusColor).trim());
  }
  if (body.url !== undefined) { fields.push("url = ?"); vals.push(String(body.url).trim()); }
  if (body.sortOrder !== undefined) { fields.push("sort_order = ?"); vals.push(Number(body.sortOrder)); }
  if (fields.length === 0) return NextResponse.json({ error: "无更新字段" }, { status: 400 });
  vals.push(id, userId);
  db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`).run(...vals);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = getUserIdFromSession(req);
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await params;
  db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(id, userId);
  return NextResponse.json({ success: true });
}