import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { emitUserEvent } from "@/lib/events";
import { track } from "@/lib/analytics";
import { updateTodoFields } from "@/lib/todos-projects";

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

  const changed = updateTodoFields(id, body);
  if (changed.length === 0) {
    return NextResponse.json({ error: "无更新字段" }, { status: 400 });
  }

  // 可选遥测：完成待办
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