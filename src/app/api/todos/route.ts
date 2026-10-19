import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { NextRequest } from "next/server";
import { readLimitedJson, RequestBodyError } from "@/lib/request-body";
import { getUserTodos } from "@/lib/todo-store";
import { getSessionUser } from "@/lib/auth";
import { emitUserEvent } from "@/lib/events";
import { createTodo } from "@/lib/todos-projects";
import {
  readExpectedRevision,
  withWorkspaceRevision,
  WorkspaceConflictError,
} from "@/lib/workspace-revision";

async function GETHandler() {
  const user = await getSessionUser();
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });
  return localizedJson({ todos: getUserTodos(user.id) });
}

const MAX_BODY_BYTES = 256 * 1024;

async function POSTHandler(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });
  const userId = user.id;
  try {
    const parsed = await readLimitedJson(req, MAX_BODY_BYTES);
    const body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    const title = String(body.title || "").trim();
    if (!title) {
      return localizedJson({ error: "待办内容不能为空" }, { status: 400 });
    }

    let id: string;
    let revision: string;
    try {
      ({ result: id, revision } = withWorkspaceRevision(
        userId,
        readExpectedRevision(req.nextUrl.searchParams, body),
        () =>
          createTodo(userId, {
            title,
            priority: body.priority,
            dueDate: body.dueDate,
            projectId: body.projectId,
            assigneeId: body.assigneeId,
            assigneeName: body.assigneeName,
          }),
      ));
    } catch (err) {
      if (err instanceof WorkspaceConflictError) {
        return localizedJson({ error: err.message, code: "WORKSPACE_CONFLICT" }, { status: 409 });
      }
      throw err;
    }

    const assigneeId = body.assigneeId ? String(body.assigneeId).trim() : "";

    emitUserEvent(userId, "todos:change");
    if (assigneeId && assigneeId !== userId) {
      emitUserEvent(assigneeId, "todos:change");
    }

    return localizedJson({ success: true, todo: { id }, revision });
  } catch (err) {
    if (err instanceof RequestBodyError) {
      return localizedJson({ error: err.message }, { status: err.status });
    }
    return localizedJson(
      { error: err instanceof Error ? err.message : "创建失败" },
      { status: 500 },
    );
  }
}

export const GET = withRequestLogging("/api/todos", GETHandler);
export const POST = withRequestLogging("/api/todos", POSTHandler);
