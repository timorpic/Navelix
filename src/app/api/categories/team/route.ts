import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { emitUserEvent } from "@/lib/events";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 1. 查询全站所有标记为团队公开的分类（来自除自己以外或包含自己的所有公开分类）
  const rows = db
    .prepare(`
      SELECT c.id, c.name, c.label, c.icon, c.color, c.user_id as owner_id,
             u.display_name as owner_display_name, u.username as owner_username, u.avatar as owner_avatar,
             (SELECT COUNT(*) FROM user_links l WHERE l.category = c.id AND l.user_id = c.user_id) as link_count
      FROM user_categories c
      JOIN users u ON u.id = c.user_id
      WHERE c.is_team_shared = 1
      ORDER BY c.name ASC
    `)
    .all() as Array<{
    id: string;
    name: string;
    label: string;
    icon: string;
    color: string;
    owner_id: string;
    owner_display_name: string | null;
    owner_username: string;
    owner_avatar: string | null;
    link_count: number;
  }>;

  // 2. 查询当前用户已订阅的分类 ID 集合
  const subs = db
    .prepare("SELECT category_id, owner_id FROM user_category_subscriptions WHERE user_id = ?")
    .all(user.id) as Array<{ category_id: string; owner_id: string }>;

  const subSet = new Set(subs.map((s) => `${s.owner_id}:${s.category_id}`));

  const teamCategories = rows.map((r) => ({
    id: r.id,
    name: r.name,
    label: r.label,
    icon: r.icon,
    color: r.color,
    ownerId: r.owner_id,
    ownerName: r.owner_display_name || r.owner_username,
    ownerAvatar: r.owner_avatar || "",
    linkCount: r.link_count,
    isOwner: r.owner_id === user.id,
    isSubscribed: subSet.has(`${r.owner_id}:${r.id}`),
  }));

  return NextResponse.json({ categories: teamCategories });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: { categoryId?: unknown; ownerId?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
  const ownerId = typeof body.ownerId === "string" ? body.ownerId.trim() : "";
  const action = body.action === "unsubscribe" ? "unsubscribe" : "subscribe";

  if (!categoryId || !ownerId) {
    return NextResponse.json({ error: "缺少分类或所有者参数" }, { status: 400 });
  }

  if (action === "subscribe") {
    // 不能订阅自己本身的分类（自身本来就拥有）
    if (ownerId === user.id) {
      return NextResponse.json({ error: "无法订阅自己的分类" }, { status: 400 });
    }

    // 安全校验：被订阅的分类必须存在且被其所有者明确设为 is_team_shared = 1
    const targetCat = db
      .prepare(
        "SELECT id FROM user_categories WHERE id = ? AND user_id = ? AND is_team_shared = 1",
      )
      .get(categoryId, ownerId);

    if (!targetCat) {
      return NextResponse.json(
        { error: "目标分类不存在或未向团队公开" },
        { status: 403 },
      );
    }

    db.prepare(`
      INSERT OR IGNORE INTO user_category_subscriptions (user_id, category_id, owner_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(user.id, categoryId, ownerId, Date.now());

    emitUserEvent(user.id, "categories:change");
    return NextResponse.json({ success: true, isSubscribed: true });
  } else {
    db.prepare(`
      DELETE FROM user_category_subscriptions
      WHERE user_id = ? AND category_id = ? AND owner_id = ?
    `).run(user.id, categoryId, ownerId);

    emitUserEvent(user.id, "categories:change");
    return NextResponse.json({ success: true, isSubscribed: false });
  }
}
