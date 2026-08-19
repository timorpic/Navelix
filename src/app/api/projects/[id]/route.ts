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
  if (body.name !== undefined) {
    fields.push("name = ?");
    vals.push(String(body.name).trim());
  }
  if (body.description !== undefined) {
    fields.push("description = ?");
    vals.push(String(body.description).trim());
  }
  if (body.status !== undefined) {
    fields.push("status = ?");
    vals.push(String(body.status).trim());
  }
  if (body.color !== undefined || body.statusColor !== undefined) {
    fields.push("status_color = ?");
    vals.push(String(body.color || body.statusColor).trim());
  }
  if (body.url !== undefined) {
    fields.push("url = ?");
    vals.push(String(body.url).trim());
  }
  if (body.sortOrder !== undefined) {
    fields.push("sort_order = ?");
    vals.push(Number(body.sortOrder));
  }

  // 始终更新 updated_at
  fields.push("updated_at = ?");
  vals.push(Date.now());

  if (fields.length > 0) {
    vals.push(id, userId);
    db.prepare(
      `UPDATE projects SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
    ).run(...vals);
  }

  // 同步更新项目关联的拆解里程碑任务 (增/改/删原子同步)
  if (Array.isArray(body.todos)) {
    const existingTodos = db
      .prepare("SELECT id FROM user_todos WHERE project_id = ? AND user_id = ?")
      .all(id, userId) as Array<{ id: string }>;
    const existingIds = new Set(existingTodos.map((t) => t.id));
    const incomingIds = new Set<string>();

    const updateStmt = db.prepare(
      `UPDATE user_todos 
       SET title = ?, priority = ?, due_date = ?, assignee_id = ?, assignee_name = ?, sort_order = ?
       WHERE id = ? AND user_id = ?`,
    );

    const insertStmt = db.prepare(
      `INSERT INTO user_todos (
        id, user_id, title, priority, done, due_date, project_id, assignee_id, assignee_name, created_at, sort_order
      ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
    );

    body.todos.forEach(
      (
        t: {
          id?: string;
          title: string;
          priority?: string;
          dueDate?: string;
          assigneeId?: string;
          assigneeName?: string;
        },
        idx: number,
      ) => {
        const tTitle = String(t.title || "").trim();
        if (!tTitle) return;

        const tPriority =
          t.priority === "high" || t.priority === "low"
            ? t.priority
            : "medium";
        const tDueDate = t.dueDate ? String(t.dueDate).slice(0, 10) : "";
        const tAssigneeId = t.assigneeId ? String(t.assigneeId).trim() : "";
        const tAssigneeName = t.assigneeName
          ? String(t.assigneeName).trim()
          : "";

        if (t.id && existingIds.has(t.id)) {
          incomingIds.add(t.id);
          updateStmt.run(
            tTitle,
            tPriority,
            tDueDate,
            tAssigneeId,
            tAssigneeName,
            idx,
            t.id,
            userId,
          );
        } else {
          const newId =
            t.id && !t.id.startsWith("temp-")
              ? t.id
              : `todo-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
          incomingIds.add(newId);
          insertStmt.run(
            newId,
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

    // 删除已被用户在编辑界面中移除的旧任务
    const deleteStmt = db.prepare(
      "DELETE FROM user_todos WHERE id = ? AND user_id = ?",
    );
    for (const oldId of existingIds) {
      if (!incomingIds.has(oldId)) {
        deleteStmt.run(oldId, userId);
      }
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const userId = user.id;
  const { id } = await params;
  // 清理项目及其子待办，保证数据库整洁与数据流一致
  db.prepare(
    "DELETE FROM user_todos WHERE project_id = ? AND user_id = ?",
  ).run(id, userId);
  db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(
    id,
    userId,
  );
  return NextResponse.json({ success: true });
}