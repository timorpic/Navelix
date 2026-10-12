import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { createShareToken } from "@/lib/share";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: { type?: unknown; id?: unknown; days?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const type = body.type === "project" ? "project" : "category";
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const days = typeof body.days === "number" && body.days > 0 ? Math.min(body.days, 365) : 30;

  if (!id) {
    return NextResponse.json({ error: "缺少目标 id" }, { status: 400 });
  }

  // 安全检查：校验请求用户是否拥有该分类或项目
  if (type === "category") {
    const cat = db
      .prepare("SELECT id FROM user_categories WHERE id = ? AND user_id = ?")
      .get(id, user.id);
    if (!cat) {
      return NextResponse.json({ error: "分类不存在或无权分享" }, { status: 404 });
    }
  } else {
    const proj = db
      .prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?")
      .get(id, user.id);
    if (!proj) {
      return NextResponse.json({ error: "项目不存在或无权分享" }, { status: 404 });
    }
  }

  const token = createShareToken(type, id, user.id, days);
  const sharePath = `/share/${type}/${id}?token=${token}`;

  return NextResponse.json({
    token,
    sharePath,
    expiresInDays: days,
  });
}
