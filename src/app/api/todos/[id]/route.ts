import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// PATCH /api/todos/[id] - toggle done / update fields
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
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const userId = user.id;

  const { id } = await params;
  db.prepare("DELETE FROM user_todos WHERE id = ? AND user_id = ?").run(id, userId);
  return NextResponse.json({ success: true });
}