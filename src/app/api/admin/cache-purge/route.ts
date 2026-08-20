import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

async function requireAdmin(req?: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdmin(req);
  if (!adminUser) {
    return NextResponse.json({ error: "无权访问，仅管理员可执行清理操作" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const target = body?.target || "all";

  let purgedCount = 0;

  if (target === "notifications" || target === "all") {
    const res = db.prepare("DELETE FROM notifications WHERE read = 1 OR created_at < ?").run(Date.now() - 7 * 24 * 60 * 60 * 1000);
    purgedCount += Number(res.changes || 0);
  }

  if (target === "vacuum" || target === "all") {
    try {
      db.exec("VACUUM;");
    } catch {}
  }

  return NextResponse.json({
    success: true,
    message: `清理维护已完成，共释放/清理了 ${purgedCount} 条历史操作记录`,
    purgedCount,
  });
}
