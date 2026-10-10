import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deleteNotification, patchNotification } from "@/lib/notification-store";

// PATCH /api/notifications/[id] - 更新通知/活动记录
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);

  if (!patchNotification(id, user.id, body ?? {})) {
    return NextResponse.json({ error: "无更新内容" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/notifications/[id] - 删除单条通知/活动记录
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  deleteNotification(id, user.id);

  return NextResponse.json({ ok: true });
}
