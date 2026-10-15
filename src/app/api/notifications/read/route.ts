import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { getSessionUser } from "@/lib/auth";
import { markAllRead } from "@/lib/notification-store";

// POST /api/notifications/read - 将当前用户全部通知标记为已读
async function POSTHandler() {
  const user = await getSessionUser();
  if (!user) {
    return localizedJson({ error: "未登录" }, { status: 401 });
  }

  markAllRead(user.id);
  return localizedJson({ ok: true });
}

export const POST = withRequestLogging("/api/notifications/read", POSTHandler);
