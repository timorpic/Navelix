import { NextRequest, NextResponse } from "next/server";
import { db, SESSION_COOKIE } from "@/lib/db";
import { createHash } from "node:crypto";
import type { TodoItem } from "@/types";

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

function rowToTodo(r: {
  id: string; title: string; priority: string; done: number;
  due_date: string; project_id: string; created_at: number; sort_order: number;
}): TodoItem {
  return {
    id: r.id, title: r.title,
    priority: (r.priority as TodoItem["priority"]) || "medium",
    done: r.done === 1,
    dueDate: r.due_date || undefined,
    projectId: r.project_id || undefined,
    createdAt: r.created_at,
    sortOrder: r.sort_order,
  };
}

export async function GET(req: NextRequest) {
  const userId = getUserIdFromSession(req);
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const rows = db
    .prepare("SELECT id, title, priority, done, due_date, project_id, created_at, sort_order FROM user_todos WHERE user_id = ? ORDER BY done ASC, sort_order ASC, created_at ASC")
    .all(userId) as Array<{
    id: string; title: string; priority: string; done: number;
    due_date: string; project_id: string; created_at: number; sort_order: number;
  }>;
  return NextResponse.json({ todos: rows.map(rowToTodo) });
}

export async function POST(req: NextRequest) {
  const userId = getUserIdFromSession(req);
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    const body = await req.json();
    const title = String(body.title || "").trim();
    if (!title) return NextResponse.json({ error: "待办内容不能为空" }, { status: 400 });
    const id = `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const priority: TodoItem["priority"] = body.priority === "high" || body.priority === "low" ? body.priority : "medium";
    const dueDate = body.dueDate ? String(body.dueDate).slice(0, 10) : "";
    const projectId = body.projectId ? String(body.projectId).trim() : "";
    const maxSort = db
      .prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM user_todos WHERE user_id = ? AND done = 0")
      .get(userId) as { m: number };
    db.prepare(
      "INSERT INTO user_todos (id, user_id, title, priority, done, due_date, project_id, created_at, sort_order) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)",
    ).run(id, userId, title, priority, dueDate, projectId, Date.now(), maxSort.m + 1);
    return NextResponse.json({ success: true, todo: { id } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "创建失败" }, { status: 500 });
  }
}