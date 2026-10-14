import { AssignmentError } from "@/lib/workspace-members";
import { localizedJson } from "@/lib/localized-json";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deleteProjectCascade, updateProject } from "@/lib/todos-projects";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });
  const userId = user.id;
  const { id } = await params;
  const body = await req.json();

  // 项目字段与里程碑在同一次「保存」里，共用一个事务（见 lib 中的说明）
  try { updateProject(id, userId, {
    name: body.name,
    description: body.description,
    status: body.status,
    color: body.color,
    statusColor: body.statusColor,
    url: body.url,
    sortOrder: body.sortOrder,
    todos: Array.isArray(body.todos) ? body.todos : undefined,
  }); } catch (error) {
    if (error instanceof AssignmentError) return localizedJson({ error: error.message }, { status: 403 });
    throw error;
  }

  return localizedJson({ success: true });
}

export async function DELETE(
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
