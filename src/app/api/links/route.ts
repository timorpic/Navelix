import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { emitUserEvent } from "@/lib/events";

function normalizeUrl(raw: string): string {
  const url = raw.trim();
  if (!/^https?:\/\//i.test(url)) {
    return `https://${url}`;
  }
  return url;
}

interface LinkInput {
  title?: unknown;
  url?: unknown;
  description?: unknown;
  category?: unknown;
  icon?: unknown;
  isQuickAccess?: unknown;
}

// GET /api/links - 当前用户的书签 + 全部分类（供扩展/快捷指令读取）
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const links = db
    .prepare(
      `SELECT id, title, url, description, icon, category, is_quick_access AS isQuickAccess
       FROM user_links WHERE user_id = ? ORDER BY is_quick_access DESC, title ASC`,
    )
    .all(user.id);

  const categories = db
    .prepare(
      "SELECT id, name, label, icon, color FROM user_categories WHERE user_id = ? ORDER BY label ASC",
    )
    .all(user.id);

  return NextResponse.json({ links, categories });
}

// POST /api/links - 单条新增书签（幂等：同 URL 已存在则返回既有记录）
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as LinkInput | null;
  if (!body || typeof body.url !== "string" || !body.url.trim()) {
    return NextResponse.json({ error: "url 不能为空" }, { status: 400 });
  }

  // 显式给出非 http/https 协议的（如 ftp://, file://）一律拒绝，避免错误前缀绕过校验
  const rawUrl = body.url.trim();
  const schemeMatch = rawUrl.match(/^([a-z][a-z0-9+.-]*?):\/\//i);
  if (schemeMatch && !/^https?$/i.test(schemeMatch[1])) {
    return NextResponse.json({ error: "仅支持 http/https 链接" }, { status: 400 });
  }

  const url = normalizeUrl(rawUrl);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "URL 格式无效" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "仅支持 http/https 链接" }, { status: 400 });
  }

  const title = typeof body.title === "string" && body.title.trim()
    ? body.title.trim().slice(0, 120)
    : parsed.hostname;
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
  const category = typeof body.category === "string" && body.category.trim() ? body.category.trim() : "favorites";
  const icon = typeof body.icon === "string" ? body.icon.trim().slice(0, 500) : "";
  const isQuickAccess = body.isQuickAccess === true || body.isQuickAccess === 1 || body.isQuickAccess === "1" ? 1 : 0;

  // 幂等：已有同 URL 则不重复插入
  const existing = db
    .prepare("SELECT * FROM user_links WHERE user_id = ? AND url = ?")
    .get(user.id, url) as Record<string, unknown> | undefined;
  if (existing) {
    return NextResponse.json({ link: existing, duplicate: true });
  }

  const id = `link-${Date.now()}-${randomBytes(3).toString("hex")}`;
  db.prepare(
    `INSERT INTO user_links (id, user_id, title, url, description, icon, category, is_quick_access)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, user.id, title, url, description, icon, category, isQuickAccess);

  // 触发实时同步通知（供网页端 / 其他终端秒级感知）
  emitUserEvent(user.id, "links:change", { linkId: id, url, title });

  return NextResponse.json(
    { link: { id, title, url, description, icon, category, isQuickAccess }, duplicate: false },
    { status: 201 },
  );
}