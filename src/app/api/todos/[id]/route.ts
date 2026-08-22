import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { emitUserEvent } from "@/lib/events";
import { track } from "@/lib/analytics";

// PATCH /api/todos/[id] - toggle done / update fields
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const userId = user.id;

  const { id } = await params;

  const todoRow = db
    .prepare("SELECT user_id, assigned_to, project_id, due_date FROM user_todos WHERE id = ?")
    .get(id) as { user_id: string; assigned_to?: string; project_id?: string; due_date?: string } | undefined;

  if (!todoRow) {
    return NextResponse.json({ error: "待办不存在" }, { status: 404 });
  }

  // 允许所有者或被委托指派人修改（如打勾完成）
  if (todoRow.user_id !== userId && todoRow.assigned_to !== userId) {
    return NextResponse.json({ error: "无权修改该待办" }, { status: 403 });
  }

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
  if (body.assigneeId !== undefined) {
    fields.push("assignee_id = ?");
    fields.push("assigned_to = ?");
    const aid = body.assigneeId ? String(body.assigneeId).trim() : "";
    vals.push(aid, aid);
  }
  if (body.assigneeName !== undefined) {
    fields.push("assignee_name = ?");
    vals.push(body.assigneeName ? String(body.assigneeName).trim() : "");
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "无更新字段" }, { status: 400 });
  }

  vals.push(id);
  db.prepare(`UPDATE user_todos SET ${fields.join(", ")} WHERE id = ?`).run(...vals);

  // 若关联了项目，同步更新项目的 updated_at
  if (todoRow.project_id) {
    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(Date.now(), todoRow.project_id);
  }

  // 可选遥测：完成待办（规范 wiki/Analytics §4.4）
  if (body.done === true || body.done === 1) {
    const todayStr = new Date().toISOString().slice(0, 10);
    track("todo.complete", {
      userId,
      meta: {
        overdue: Boolean(todoRow.due_date && todoRow.due_date < todayStr),
        projectId: todoRow.project_id || undefined,
      },
    });
  }

  // 触发实时通知，同时通知创建者与被委托人
  emitUserEvent(todoRow.user_id, "todos:change");
  if (todoRow.assigned_to && todoRow.assigned_to !== todoRow.user_id) {
    emitUserEvent(todoRow.assigned_to, "todos:change");
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/todos/[id] - delete a todo
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const userId = user.id;

  const { id } = await params;

  const todoRow = db
    .prepare("SELECT user_id, assigned_to FROM user_todos WHERE id = ?")
    .get(id) as { user_id: string; assigned_to?: string } | undefined;

  if (!todoRow) {
    return NextResponse.json({ success: true });
  }

  if (todoRow.user_id !== userId) {
    return NextResponse.json({ error: "仅任务创建者可删除该待办" }, { status: 403 });
  }

  db.prepare("DELETE FROM user_todos WHERE id = ?").run(id);

  emitUserEvent(todoRow.user_id, "todos:change");
  if (todoRow.assigned_to && todoRow.assigned_to !== todoRow.user_id) {
    emitUserEvent(todoRow.assigned_to, "todos:change");
  }

  return NextResponse.json({ success: true });
}