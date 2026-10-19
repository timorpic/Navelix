import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { NextRequest } from "next/server";
import { readLimitedJson, RequestBodyError } from "@/lib/request-body";
import { getSessionUser } from "@/lib/auth";
import { deleteProjectCascade, updateProject } from "@/lib/todos-projects";
import {
  readExpectedRevision,
  withWorkspaceRevision,
  WorkspaceConflictError,
} from "@/lib/workspace-revision";

/**
 * 实体写接口的并发保护。
 *
 * `expectedRevision` 可选：Web 客户端由 Provider 自动注入；公开 REST API 的
 * Token 客户端不带该字段时跳过校验（向后兼容）。响应始终回传新 revision，
 * 让调用方能继续链式写入。
 */
const MAX_BODY_BYTES = 1024 * 1024;

function conflict(err: unknown) {
  if (err instanceof WorkspaceConflictError) {
    return localizedJson({ error: err.message, code: "WORKSPACE_CONFLICT" }, { status: 409 });
  }
  throw err;
}

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

  // 项目字段与里程碑在同一次「保存」里，共用一个事务（见 lib 中的说明）
  try {
    const { revision } = withWorkspaceRevision(
      userId,
      readExpectedRevision(req.nextUrl.searchParams, body),
      () =>
        updateProject(id, userId, {
          name: body.name,
          description: body.description,
          status: body.status,
          color: body.color,
          statusColor: body.statusColor,
          url: body.url,
          sortOrder: body.sortOrder,
          todos: Array.isArray(body.todos) ? body.todos : undefined,
        }),
    );
    return localizedJson({ success: true, revision });
  } catch (err) {
    return conflict(err);
  }
}

async function DELETEHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });
  const userId = user.id;
  const { id } = await params;
  // 清理项目及其子待办（单事务），保证数据库整洁与数据流一致
  try {
    const { revision } = withWorkspaceRevision(
      userId,
      readExpectedRevision(req.nextUrl.searchParams),
      () => deleteProjectCascade(id, userId),
    );
    return localizedJson({ success: true, revision });
  } catch (err) {
    return conflict(err);
  }
}

export const PATCH = withRequestLogging("/api/projects/[id]", PATCHHandler);
export const DELETE = withRequestLogging("/api/projects/[id]", DELETEHandler);
