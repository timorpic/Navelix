import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

interface NotificationRow {
  id: string;
  title: string;
  content: string;
  source?: string;
  created_at: number;
  read: number;
}

function toNotification(row: NotificationRow) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    source: row.source || "system",
    createdAt: row.created_at,
    read: row.read === 1,
  };
}

// GET /api/notifications - 当前用户的操作记录（最新在前）
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const rows = db
    .prepare(
      `SELECT id, title, content, source, created_at, read
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
    )
    .all(user.id) as unknown as NotificationRow[];

  const unreadRow = db
    .prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0")
    .get(user.id) as { c: number };

  return NextResponse.json({
    notifications: rows.map(toNotification),
    unreadCount: unreadRow.c,
  });
}

// POST /api/notifications - 记录一条当前用户的操作通知，携带声明来源（source / tag）
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  const content = String(body?.content ?? "").trim();
  const source = String(body?.source || body?.tag || body?.category || "system").trim();

  if (!title) {
    return NextResponse.json({ error: "通知标题不能为空" }, { status: 400 });
  }

  const id = randomBytes(16).toString("hex");
  db.prepare(
    `INSERT INTO notifications (id, user_id, title, content, source, created_at, read)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
  ).run(id, user.id, title, content, source, Date.now());

  return NextResponse.json(
    {
      notification: toNotification({
        id,
        title,
        content,
        source,
        created_at: Date.now(),
        read: 0,
      }),
    },
    { status: 201 },
  );
}

// DELETE /api/notifications - 清空当前用户全部操作记录
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  db.prepare("DELETE FROM notifications WHERE user_id = ?").run(user.id);
  return NextResponse.json({ ok: true });
}
