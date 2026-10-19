import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { readLimitedJson, RequestBodyError } from "@/lib/request-body";
import { getSessionUser } from "@/lib/auth";
import { confirmPendingDelete } from "@/lib/ai-tools";

/**
 * 删除确认（确定性路径）。
 *
 * AI 发起的删除先由 /api/ai/chat 暂存，并在响应里返回 pendingId；
 * 前端确认卡把 pendingId + 枚举 decision 发到这里。服务端不解析任何
 * 自然语言，pendingId 与用户一一绑定，过期或不属于当前用户均返回 404。
 */
const MAX_BODY_BYTES = 4 * 1024;

async function POSTHandler(req: Request) {
  const user = await getSessionUser();
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });

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

  const decision = body.decision;
  if (decision !== "confirm" && decision !== "cancel") {
    return localizedJson({ error: "无效操作" }, { status: 400 });
  }

  const result = confirmPendingDelete(user.id, body.pendingId, decision);
  if (!result) {
    return localizedJson(
      { error: "确认请求不存在或已过期，请重新发起删除。", code: "DELETE_CONFIRMATION_INVALID" },
      { status: 404 },
    );
  }
  if (!result.ok) {
    return localizedJson({ error: result.error }, { status: 409 });
  }
  return localizedJson({ success: true, message: result.message });
}

export const POST = withRequestLogging("/api/ai/confirm-delete", POSTHandler);
