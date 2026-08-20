import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { addDaysLocal, toZonedLocalDateStr } from "@/lib/date-utils";

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

    // 查询所有过期且未完成的待办事项 (due_date < todayStr AND due_date != '' AND done = 0)
    const overdueTodos = db
      .prepare(
        "SELECT id, title, due_date FROM user_todos WHERE user_id = ? AND done = 0 AND due_date != '' AND due_date < ? ORDER BY sort_order ASC",
      )
      .all(user.id, todayStr) as Array<{ id: string; title: string; due_date: string }>;

    if (overdueTodos.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: "当前没有需要顺延的过期待办事项",
      });
    }

    const updateStmt = db.prepare(
      "UPDATE user_todos SET due_date = ? WHERE id = ? AND user_id = ?",
    );

    if (action === "today") {
      // 全部顺延至今日
      overdueTodos.forEach((t) => {
        updateStmt.run(todayStr, t.id, user.id);
      });
    } else {
      // 均匀平摊到本周剩余天数（从今天到周日）
      const today = new Date();
      const currentDay = today.getDay() === 0 ? 7 : today.getDay(); // 1=Mon, 7=Sun
      const remainingDays = Math.max(1, 7 - currentDay + 1);

      overdueTodos.forEach((t, index) => {
        const offset = index % remainingDays;
        const targetStr = addDaysLocal(todayStr, offset);
        updateStmt.run(targetStr, t.id, user.id);
      });
    }

    return NextResponse.json({
      success: true,
      count: overdueTodos.length,
      action,
      message:
        action === "today"
          ? `已成功将 ${overdueTodos.length} 项过期任务一键顺延至今日！`
          : `已成功将 ${overdueTodos.length} 项过期任务均匀平摊至本周！`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "顺延失败" },
      { status: 500 },
    );
  }
}
