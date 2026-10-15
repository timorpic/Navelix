import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deleteProjectCascade, updateProject } from "@/lib/todos-projects";

async function PATCHHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });
  const userId = user.id;
  const { id } = await params;
  const body = await req.json();

  // 项目字段与里程碑在同一次「保存」里，共用一个事务（见 lib 中的说明）
  updateProject(id, userId, {
    name: body.name,
    description: body.description,
    status: body.status,
    color: body.color,
    statusColor: body.statusColor,
    url: body.url,
    sortOrder: body.sortOrder,
    todos: Array.isArray(body.todos) ? body.todos : undefined,
  });

  return localizedJson({ success: true });
}

async function DELETEHandler(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });
  const userId = user.id;
  const { id } = await params;
  // 清理项目及其子待办（单事务），保证数据库整洁与数据流一致
  deleteProjectCascade(id, userId);
  return localizedJson({ success: true });
}

export const PATCH = withRequestLogging("/api/projects/[id]", PATCHHandler);
export const DELETE = withRequestLogging("/api/projects/[id]", DELETEHandler);
