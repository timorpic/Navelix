import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { toZonedLocalDateStr } from "@/lib/date-utils";
import { rolloverOverdueTodos } from "@/lib/todos-projects";
import {
  readExpectedRevision,
  withWorkspaceRevision,
  WorkspaceConflictError,
} from "@/lib/workspace-revision";

async function POSTHandler(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return localizedJson({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action === "week" ? "week" : "today";
    // 优先采用客户端浏览器计算好的本地日期，兜底按 Asia/Shanghai 取时区安全值
    const todayStr = /^\d{4}-\d{2}-\d{2}$/.test(String(body.today || ""))
      ? String(body.today)
      : toZonedLocalDateStr(new Date(), "Asia/Shanghai");

    let count: number;
    let revision: string;
    try {
      ({ result: { count }, revision } = withWorkspaceRevision(
        user.id,
        readExpectedRevision(req.nextUrl.searchParams, body),
        () => rolloverOverdueTodos(user.id, todayStr, action),
      ));
    } catch (err) {
      if (err instanceof WorkspaceConflictError) {
        return localizedJson({ error: err.message, code: "WORKSPACE_CONFLICT" }, { status: 409 });
      }
      throw err;
    }

    if (count === 0) {
      return localizedJson({
        success: true,
        count: 0,
        revision,
        message: "当前没有需要顺延的过期待办事项",
      });
    }

    return localizedJson({
      success: true,
      count,
      revision,
      action,
      message:
        action === "today"
          ? `已成功将 ${count} 项过期任务一键顺延至今日！`
          : `已成功将 ${count} 项过期任务均匀平摊至本周！`,
    });
  } catch (err) {
    return localizedJson(
      { error: err instanceof Error ? err.message : "顺延失败" },
      { status: 500 },
    );
  }
}

export const POST = withRequestLogging("/api/todos/rollover", POSTHandler);
