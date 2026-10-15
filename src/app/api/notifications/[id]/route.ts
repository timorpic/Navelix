import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deleteNotification, patchNotification } from "@/lib/notification-store";

// PATCH /api/notifications/[id] - 更新通知/活动记录
async function PATCHHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser(req);
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);

  if (!patchNotification(id, user.id, body ?? {})) {
    return localizedJson({ error: "无更新内容" }, { status: 400 });
  }

  return localizedJson({ ok: true });
}

// DELETE /api/notifications/[id] - 删除单条通知/活动记录
async function DELETEHandler(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser(req);
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  deleteNotification(id, user.id);

  return localizedJson({ ok: true });
}

export const PATCH = withRequestLogging("/api/notifications/[id]", PATCHHandler);
export const DELETE = withRequestLogging("/api/notifications/[id]", DELETEHandler);
