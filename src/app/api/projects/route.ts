import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { track } from "@/lib/analytics";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const userId = user.id;
  const rows = db
    .prepare(
      `SELECT id, name, description, status, status_color, url, sort_order, created_at, updated_at 
       FROM projects 
       WHERE user_id = ? 
       ORDER BY sort_order ASC, created_at DESC`,
    )
    .all(userId) as {
    id: string;
    name: string;
    description: string;
    status: string;
    status_color: string;
    url: string;
    sort_order: number;
    created_at: number;
    updated_at: number;
  }[];
  return NextResponse.json({
    projects: rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description || "",
      status: r.status || "进行中",
      color: r.status_color || "#00C776",
      statusColor: r.status_color || "#00C776",
      url: r.url || "",
      sortOrder: r.sort_order,
      createdAt: r.created_at || 0,
      updatedAt: r.updated_at || r.created_at || 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const userId = user.id;
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name)
      return NextResponse.json({ error: "项目名不能为空" }, { status: 400 });
    const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const description = String(body.description || "").trim();
    const status = String(body.status || "进行中").trim();
    const color = String(body.color || body.statusColor || "#00C776").trim();
    const url = String(body.url || "").trim();
    const now = Date.now();

    const maxSort = db
      .prepare(
        "SELECT COALESCE(MAX(sort_order), -1) AS m FROM projects WHERE user_id = ?",
      )
      .get(userId) as { m: number };

    // 插入项目主记录
    db.prepare(
      `INSERT INTO projects (id, user_id, name, description, status, status_color, url, sort_order, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, userId, name, description, status, color, url, maxSort.m + 1, now, now);

    // 支持在创建项目时一并写入拆解出来的 todos / 日程事项
    if (Array.isArray(body.todos) && body.todos.length > 0) {
      const insertTodo = db.prepare(
        "INSERT INTO user_todos (id, user_id, title, priority, done, due_date, project_id, assignee_id, assignee_name, created_at, sort_order) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)",
      );
      body.todos.forEach(
        (
          t: {
            title: string;
            priority?: string;
            dueDate?: string;
            assigneeId?: string;
            assigneeName?: string;
          },
          idx: number,
        ) => {
          const tTitle = String(t.title || "").trim();
          if (tTitle) {
            const tId = `todo-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
            const tPriority =
              t.priority === "high" || t.priority === "low"
                ? t.priority
                : "medium";
            const tDueDate = t.dueDate ? String(t.dueDate).slice(0, 10) : "";
            const tAssigneeId = t.assigneeId ? String(t.assigneeId).trim() : "";
            const tAssigneeName = t.assigneeName
              ? String(t.assigneeName).trim()
              : "";
            insertTodo.run(
              tId,
              userId,
              tTitle,
              tPriority,
              tDueDate,
              id,
              tAssigneeId,
              tAssigneeName,
              Date.now() + idx,
              idx,
            );
          }
        },
      );
    }

    track("project.create", {
      userId,
      meta: { milestoneCount: Array.isArray(body.todos) ? body.todos.length : 0 },
    });

    return NextResponse.json({
      success: true,
      project: {
        id,
        name,
        status,
        color,
        statusColor: color,
        url,
        sortOrder: maxSort.m + 1,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "创建失败" },
      { status: 500 },
    );
  }
}