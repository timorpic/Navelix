import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { emitUserEvent } from "@/lib/events";
import type { TodoItem } from "@/types";

function rowToTodo(
  r: {
    id: string;
    user_id: string;
    title: string;
    priority: string;
    done: number;
    due_date: string;
    project_id: string;
    assignee_id?: string;
    assignee_name?: string;
    owner_display_name?: string | null;
    owner_username?: string | null;
    created_at: number;
    sort_order: number;
  },
  currentUserId: string,
): TodoItem {
  const isDelegated = r.user_id !== currentUserId;
  return {
    id: r.id,
    title: r.title,
    priority: (r.priority as TodoItem["priority"]) || "medium",
    done: r.done === 1,
    dueDate: r.due_date || undefined,
    projectId: r.project_id || undefined,
    assigneeId: r.assignee_id || undefined,
    assigneeName: r.assignee_name || undefined,
    ownerId: r.user_id,
    ownerName: r.owner_display_name || r.owner_username || undefined,
    isDelegated,
    createdAt: r.created_at,
    sortOrder: r.sort_order,
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const userId = user.id;

  const rows = db
    .prepare(
      `SELECT t.id, t.user_id, t.title, t.priority, t.done, t.due_date, t.project_id,
              COALESCE(NULLIF(t.assigned_to, ''), t.assignee_id) AS assignee_id,
              t.assignee_name, t.created_at, t.sort_order,
              u.display_name AS owner_display_name, u.username AS owner_username
       FROM user_todos t
       LEFT JOIN users u ON u.id = t.user_id
       WHERE t.user_id = ? OR t.assigned_to = ? OR t.assignee_id = ?
       ORDER BY t.done ASC, t.sort_order ASC, t.created_at ASC`,
    )
    .all(userId, userId, userId) as Array<{
    id: string;
    user_id: string;
    title: string;
    priority: string;
    done: number;
    due_date: string;
    project_id: string;
    assignee_id?: string;
    assignee_name?: string;
    owner_display_name?: string | null;
    owner_username?: string | null;
    created_at: number;
    sort_order: number;
  }>;

  return NextResponse.json({ todos: rows.map((r) => rowToTodo(r, userId)) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const userId = user.id;
  try {
    const body = await req.json();
    const title = String(body.title || "").trim();
    if (!title)
      return NextResponse.json({ error: "待办内容不能为空" }, { status: 400 });
    const id = `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const priority: TodoItem["priority"] =
      body.priority === "high" || body.priority === "low"
        ? body.priority
        : "medium";
    const dueDate = body.dueDate ? String(body.dueDate).slice(0, 10) : "";
    const projectId = body.projectId ? String(body.projectId).trim() : "";
    const assigneeId = body.assigneeId ? String(body.assigneeId).trim() : "";
    const assigneeName = body.assigneeName
      ? String(body.assigneeName).trim()
      : "";

    const maxSort = db
      .prepare(
        "SELECT COALESCE(MAX(sort_order), -1) AS m FROM user_todos WHERE user_id = ? AND done = 0",
      )
      .get(userId) as { m: number };

    db.prepare(
      `INSERT INTO user_todos (
        id, user_id, title, priority, done, due_date, project_id, assigned_to, assignee_id, assignee_name, created_at, sort_order
      ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      userId,
      title,
      priority,
      dueDate,
      projectId,
      assigneeId,
      assigneeId,
      assigneeName,
      Date.now(),
      maxSort.m + 1,
    );

    if (projectId) {
      db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(Date.now(), projectId);
    }

    emitUserEvent(userId, "todos:change");
    if (assigneeId && assigneeId !== userId) {
      emitUserEvent(assigneeId, "todos:change");
    }

    return NextResponse.json({ success: true, todo: { id } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "创建失败" },
      { status: 500 },
    );
  }
}