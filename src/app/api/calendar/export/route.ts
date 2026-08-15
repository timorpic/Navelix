import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db, type UserRow } from "@/lib/db";
import { getSessionUser, toPublicUser } from "@/lib/auth";

function formatDateToIcs(dateStr: string): string {
  // input: YYYY-MM-DD -> output: YYYYMMDD
  return dateStr.replace(/-/g, "");
}

function getNextDayIcs(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export async function GET(req: NextRequest) {
  let user = await getSessionUser(req);

  // 若未通过 Header / Session 鉴权，尝试从 URL Query 中提取 Token (兼容 iOS / Apple Calendar / Outlook 日历订阅链接)
  if (!user) {
    const url = new URL(req.url);
    const queryToken = url.searchParams.get("token") || url.searchParams.get("key");
    if (queryToken && queryToken.startsWith("nvx_live_")) {
      const tokenHash = createHash("sha256").update(queryToken).digest("hex");
      const tokenRow = db
        .prepare(
          `SELECT u.id, u.username, u.password_hash, u.display_name, u.email, u.bio, u.role, u.avatar, u.created_at
           FROM api_tokens t
           JOIN users u ON u.id = t.user_id
           WHERE t.token_hash = ?`,
        )
        .get(tokenHash) as UserRow | undefined;
      if (tokenRow) {
        user = toPublicUser(tokenRow);
      }
    }
  }

  if (!user) {
    return NextResponse.json({ error: "未登录或日历订阅密钥无效" }, { status: 401 });
  }

  try {
    // 1. 读取该用户的所有待办与所属项目名称
    const todos = db
      .prepare(
        `SELECT t.id, t.title, t.priority, t.done, t.due_date, t.created_at, p.name AS project_name
         FROM user_todos t
         LEFT JOIN projects p ON t.project_id = p.id
         WHERE t.user_id = ?
         ORDER BY t.due_date ASC, t.created_at ASC`,
      )
      .all(user.id) as Array<{
      id: string;
      title: string;
      priority: string;
      done: number;
      due_date: string;
      created_at: number;
      project_name?: string;
    }>;

    // 2. 组装 RFC 5545 iCalendar 标准文本
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Navelix//Personal Digital OS//CN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Navelix 工作日程与项目里程碑",
      "X-WR-TIMEZONE:Asia/Shanghai",
      "X-WR-CALDESC:Navelix 个人工作台日历日程与项目待办同步",
    ];

    for (const todo of todos) {
      if (!todo.due_date || !/^\d{4}-\d{2}-\d{2}$/.test(todo.due_date)) {
        continue;
      }

      const dtStart = formatDateToIcs(todo.due_date);
      const dtEnd = getNextDayIcs(todo.due_date);
      const prioText =
        todo.priority === "high" ? "高优先级" : todo.priority === "low" ? "普通" : "中等优先级";
      const projectText = todo.project_name ? `所属项目: ${todo.project_name}` : "无所属项目";
      const statusText = todo.done ? "COMPLETED" : "CONFIRMED";

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:todo-${todo.id}@navelix.local`);
      lines.push(`DTSTAMP:${formatDateToIcs(new Date().toISOString().split("T")[0])}T000000Z`);
      lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
      lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
      lines.push(`SUMMARY:${todo.title.replace(/\n/g, " ")}`);
      lines.push(`DESCRIPTION:【${prioText}】${projectText}`);
      lines.push(`STATUS:${statusText}`);
      if (todo.priority === "high") {
        lines.push("PRIORITY:1");
      } else if (todo.priority === "medium") {
        lines.push("PRIORITY:5");
      } else {
        lines.push("PRIORITY:9");
      }
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    const icsContent = lines.join("\r\n");

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="navelix-schedule.ics"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导出日历失败" },
      { status: 500 },
    );
  }
}
