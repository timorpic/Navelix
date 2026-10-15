import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { NextRequest } from "next/server";
import { getUserTodos } from "@/lib/todo-store";
import { getSessionUser } from "@/lib/auth";
import { emitUserEvent } from "@/lib/events";
import { createTodo } from "@/lib/todos-projects";

async function GETHandler() {
  const user = await getSessionUser();
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });
  return localizedJson({ todos: getUserTodos(user.id) });
}

async function POSTHandler(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });
  const userId = user.id;
  try {
    const body = await req.json();
    const title = String(body.title || "").trim();
    if (!title) {
      return localizedJson({ error: "待办内容不能为空" }, { status: 400 });
    }

    const id = createTodo(userId, {
      title,
      priority: body.priority,
      dueDate: body.dueDate,
      projectId: body.projectId,
      assigneeId: body.assigneeId,
      assigneeName: body.assigneeName,
    });

    const assigneeId = body.assigneeId ? String(body.assigneeId).trim() : "";

    emitUserEvent(userId, "todos:change");
    if (assigneeId && assigneeId !== userId) {
      emitUserEvent(assigneeId, "todos:change");
    }

    return localizedJson({ success: true, todo: { id } });
  } catch (err) {
    return localizedJson(
      { error: err instanceof Error ? err.message : "创建失败" },
      { status: 500 },
    );
  }
}

export const GET = withRequestLogging("/api/todos", GETHandler);
export const POST = withRequestLogging("/api/todos", POSTHandler);
