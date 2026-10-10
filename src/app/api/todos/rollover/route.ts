import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { toZonedLocalDateStr } from "@/lib/date-utils";
import { rolloverOverdueTodos } from "@/lib/todos-projects";
import { track } from "@/lib/analytics";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action === "week" ? "week" : "today";
    // 优先采用客户端浏览器计算好的本地日期，兜底按 Asia/Shanghai 取时区安全值
    const todayStr = /^\d{4}-\d{2}-\d{2}$/.test(String(body.today || ""))
      ? String(body.today)
      : toZonedLocalDateStr(new Date(), "Asia/Shanghai");

    const { count } = rolloverOverdueTodos(user.id, todayStr, action);

    if (count === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: "当前没有需要顺延的过期待办事项",
      });
    }

    track("todo.rollover", {
      userId: user.id,
      meta: { mode: action, count },
    });

    return NextResponse.json({
      success: true,
      count,
      action,
      message:
        action === "today"
          ? `已成功将 ${count} 项过期任务一键顺延至今日！`
          : `已成功将 ${count} 项过期任务均匀平摊至本周！`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "顺延失败" },
      { status: 500 },
    );
  }
}
