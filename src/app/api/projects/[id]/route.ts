import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { track } from "@/lib/analytics";
import { deleteProjectCascade, updateProject } from "@/lib/todos-projects";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
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

  track("project.update", {
    userId,
    meta: {
      milestoneCount: Array.isArray(body.todos) ? body.todos.length : undefined,
    },
  });

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
  // 清理项目及其子待办（单事务），保证数据库整洁与数据流一致
  deleteProjectCascade(id, userId);
  return NextResponse.json({ success: true });
}