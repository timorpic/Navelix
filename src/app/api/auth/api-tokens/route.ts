import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { createHash, randomBytes } from "node:crypto";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface ApiTokenItem {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: number;
  lastUsedAt: number | null;
}

// GET /api/auth/api-tokens - 获取用户的 API Token 列表
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const rows = db
    .prepare(
      `SELECT id, name, token_prefix, created_at, last_used_at
       FROM api_tokens
       WHERE user_id = ?
       ORDER BY created_at DESC`,
    )
    .all(user.id) as Array<{
    id: string;
    name: string;
    token_prefix: string;
    created_at: number;
    last_used_at: number | null;
  }>;

  const tokens: ApiTokenItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    tokenPrefix: r.token_prefix,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
  }));

  return NextResponse.json({ tokens });
}

// POST /api/auth/api-tokens - 创建新的个人 API Token
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name = String(body?.name || "默认 API 密钥").trim();

  if (!name) {
    return NextResponse.json({ error: "请提供密钥名称" }, { status: 400 });
  }

  // 生成 Token 密钥 (前缀 nvx_live_ + 32字节 hex)
  const secretPart = randomBytes(24).toString("hex");
  const rawToken = `nvx_live_${secretPart}`;
  const tokenPrefix = `nvx_live_${secretPart.slice(0, 4)}...${secretPart.slice(-4)}`;
  const tokenId = `tok_${randomBytes(8).toString("hex")}`;
  const tokenHash = hashToken(rawToken);
  const now = Date.now();

  db.prepare(
    `INSERT INTO api_tokens (id, user_id, name, token_hash, token_prefix, created_at, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
  ).run(tokenId, user.id, name, tokenHash, tokenPrefix, now);

  return NextResponse.json({
    success: true,
    token: rawToken,
    tokenId,
    name,
    tokenPrefix,
    message: "API 密钥生成成功！请务必妥善保管，该密钥仅显示一次。",
  });
}

// DELETE /api/auth/api-tokens - 删除/撤销指定的 API Token
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const tokenId = body?.id;

  if (!tokenId) {
    return NextResponse.json({ error: "缺少 tokenId 参数" }, { status: 400 });
  }

  db.prepare("DELETE FROM api_tokens WHERE id = ? AND user_id = ?").run(
    tokenId,
    user.id,
  );

  return NextResponse.json({
    success: true,
    message: "已撤销并删除指定的 API 密钥",
  });
}
