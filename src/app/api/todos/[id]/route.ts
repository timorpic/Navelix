import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { NextRequest } from "next/server";
import { readLimitedJson, RequestBodyError } from "@/lib/request-body";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { emitUserEvent } from "@/lib/events";
import { resolveTodoOwner } from "@/lib/todo-store";
import { updateTodoFields } from "@/lib/todos-projects";
import {
  readExpectedRevision,
  withWorkspaceRevision,
  WorkspaceConflictError,
} from "@/lib/workspace-revision";

/**
 * 待办写接口的并发保护。
 *
 * 被委托人（ownerId ≠ 当前登录用户）操作他人工作区的待办时不做 revision
 * 校验：workspace revision 是「按用户」计算的，用委托人的 revision 去校验
 * 属主的工作区没有意义，反而会误拒正常协作。属主改自己的待办时正常校验。
 */
const MAX_BODY_BYTES = 256 * 1024;

function conflict(err: unknown) {
  if (err instanceof WorkspaceConflictError) {
    return localizedJson({ error: err.message, code: "WORKSPACE_CONFLICT" }, { status: 409 });
  }
  throw err;
}

// PATCH /api/todos/[id] - toggle done / update fields
async function PATCHHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });
  const userId = user.id;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    const parsed = await readLimitedJson(req, MAX_BODY_BYTES);
    body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch (err) {
    if (err instanceof RequestBodyError) {
      return localizedJson({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  const ownerId = resolveTodoOwner(id, userId, req.nextUrl.searchParams.get("ownerId") || undefined);
  if (!ownerId) return localizedJson({ error: "待办不存在、身份不明确或无权操作" }, { status: 404 });
  const todoRow = db
    .prepare("SELECT user_id, COALESCE(NULLIF(assignee_id, ''), assigned_to) AS assigned_to, project_id, due_date FROM user_todos WHERE id = ? AND user_id = ?")
    .get(id, ownerId) as { user_id: string; assigned_to?: string; project_id?: string; due_date?: string } | undefined;

  if (!todoRow) {
    return localizedJson({ error: "待办不存在" }, { status: 404 });
  }

  // 允许所有者或被委托指派人修改（如打勾完成）
  if (todoRow.user_id !== userId && todoRow.assigned_to !== userId) {
    return localizedJson({ error: "无权修改该待办" }, { status: 403 });
  }

  const expected = ownerId === userId
    ? readExpectedRevision(req.nextUrl.searchParams, body)
    : undefined;

  let changed: string[] = [];
  let revision: string;
  try {
    ({ result: changed, revision } = withWorkspaceRevision(userId, expected, () =>
      updateTodoFields(id, ownerId, body),
    ));
  } catch (err) {
    return conflict(err);
  }
  if (changed.length === 0) {
    return localizedJson({ error: "无更新字段" }, { status: 400 });
  }

  // 触发实时通知，同时通知创建者与被委托人
  emitUserEvent(todoRow.user_id, "todos:change");
  if (todoRow.assigned_to && todoRow.assigned_to !== todoRow.user_id) {
    emitUserEvent(todoRow.assigned_to, "todos:change");
  }

  if (typeof body.assigneeId === "string" && body.assigneeId && body.assigneeId !== todoRow.assigned_to && body.assigneeId !== todoRow.user_id) {
    emitUserEvent(body.assigneeId, "todos:change");
  }
  return localizedJson({ success: true, revision });
}

// DELETE /api/todos/[id] - delete a todo
async function DELETEHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });
  const userId = user.id;

  const { id } = await params;

  const ownerId = resolveTodoOwner(id, userId, req.nextUrl.searchParams.get("ownerId") || undefined);
  if (!ownerId) return localizedJson({ error: "待办不存在、身份不明确或无权操作" }, { status: 404 });
  const todoRow = db
    .prepare("SELECT user_id, COALESCE(NULLIF(assignee_id, ''), assigned_to) AS assigned_to FROM user_todos WHERE id = ? AND user_id = ?")
    .get(id, ownerId) as { user_id: string; assigned_to?: string } | undefined;

  if (!todoRow) {
    return localizedJson({ success: true, revision: undefined });
  }

  if (todoRow.user_id !== userId) {
    return localizedJson({ error: "仅任务创建者可删除该待办" }, { status: 403 });
  }

  const expected = ownerId === userId
    ? readExpectedRevision(req.nextUrl.searchParams)
    : undefined;

  let revision: string;
  try {
    ({ revision } = withWorkspaceRevision(userId, expected, () => {
      db.prepare("DELETE FROM user_todos WHERE id = ? AND user_id = ?").run(id, ownerId);
    }));
  } catch (err) {
    return conflict(err);
  }

  emitUserEvent(todoRow.user_id, "todos:change");
  if (todoRow.assigned_to && todoRow.assigned_to !== todoRow.user_id) {
    emitUserEvent(todoRow.assigned_to, "todos:change");
  }

  return localizedJson({ success: true, revision });
}

export const PATCH = withRequestLogging("/api/todos/[id]", PATCHHandler);
export const DELETE = withRequestLogging("/api/todos/[id]", DELETEHandler);
