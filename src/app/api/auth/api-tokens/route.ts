import { localizedJson } from "@/lib/localized-json";
import { getSessionUser } from "@/lib/auth";
import { issueApiToken, listApiTokens, revokeApiToken } from "@/lib/auth/api-tokens";

// GET /api/auth/api-tokens - 获取用户的 API Token 列表
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return localizedJson({ error: "未登录" }, { status: 401 });
  }

  return localizedJson({ tokens: listApiTokens(user.id) });
}

// POST /api/auth/api-tokens - 创建新的个人 API Token
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return localizedJson({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name = String(body?.name || "默认 API 密钥").trim();

  if (!name) {
    return localizedJson({ error: "请提供密钥名称" }, { status: 400 });
  }

  const issued = issueApiToken(user.id, name);

  return localizedJson({
    success: true,
    token: issued.token,
    tokenId: issued.tokenId,
    name: issued.name,
    tokenPrefix: issued.tokenPrefix,
    expiresAt: issued.expiresAt,
    message: "API 密钥生成成功！请务必妥善保管，该密钥仅显示一次。",
  });
}

// DELETE /api/auth/api-tokens - 删除/撤销指定的 API Token
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return localizedJson({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const tokenId = body?.id;

  if (!tokenId) {
    return localizedJson({ error: "缺少 id 参数" }, { status: 400 });
  }

  revokeApiToken(user.id, String(tokenId));

  return localizedJson({
    success: true,
    message: "已撤销并删除指定的 API 密钥",
  });
}
