import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const userId = user.id;
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
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const userId = user.id;
  const { id } = await params;
  db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(id, userId);
  return NextResponse.json({ success: true });
}