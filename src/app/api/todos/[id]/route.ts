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

// PATCH /api/todos/[id] - toggle done / update fields
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

  if (body.done !== undefined) {
    fields.push("done = ?");
    vals.push(body.done ? 1 : 0);
  }
  if (body.title !== undefined) {
    fields.push("title = ?");
    vals.push(String(body.title).trim());
  }
  if (body.priority !== undefined) {
    fields.push("priority = ?");
    vals.push(String(body.priority));
  }
  if (body.dueDate !== undefined) {
    fields.push("due_date = ?");
    vals.push(body.dueDate ? String(body.dueDate).slice(0, 10) : "");
  }
  if (body.sortOrder !== undefined) {
    fields.push("sort_order = ?");
    vals.push(Number(body.sortOrder));
  }
  if (body.projectId !== undefined) {
    fields.push("project_id = ?");
    vals.push(body.projectId ? String(body.projectId).trim() : "");
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "无更新字段" }, { status: 400 });
  }

  vals.push(id, userId);
  db.prepare(`UPDATE user_todos SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`).run(...vals);
  return NextResponse.json({ success: true });
}

// DELETE /api/todos/[id] - delete a todo
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = getUserIdFromSession(req);
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  db.prepare("DELETE FROM user_todos WHERE id = ? AND user_id = ?").run(id, userId);
  return NextResponse.json({ success: true });
}