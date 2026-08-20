import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// PATCH /api/notifications/[id] - 更新通知/活动记录
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const fields: string[] = [];
  const vals: (string | number)[] = [];

  if (body?.title !== undefined) {
    fields.push("title = ?");
    vals.push(String(body.title).trim());
  }
  if (body?.content !== undefined) {
    fields.push("content = ?");
    vals.push(String(body.content).trim());
  }
  if (body?.read !== undefined) {
    fields.push("read = ?");
    vals.push(body.read ? 1 : 0);
  }
  if (body?.source !== undefined) {
    fields.push("source = ?");
    vals.push(String(body.source).trim());
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "无更新内容" }, { status: 400 });
  }

  vals.push(id, user.id);
  db.prepare(
    `UPDATE notifications SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
  ).run(...vals);

  return NextResponse.json({ ok: true });
}

// DELETE /api/notifications/[id] - 删除单条通知/活动记录
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  db.prepare("DELETE FROM notifications WHERE id = ? AND user_id = ?").run(
    id,
    user.id,
  );

  return NextResponse.json({ ok: true });
}
