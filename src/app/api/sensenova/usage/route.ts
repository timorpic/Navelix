import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUsage, type UsageResponse } from "@/lib/sensenova";
import { decryptSecret } from "@/lib/secret";

// 仅在 Node.js 运行时执行（依赖 fs / crypto / 原生 fetch，且需写入 token 缓存）
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/sensenova/usage
// 返回当前账户各模型「计费窗口剩余调用额度百分比」。
// 凭据与开关均存于 user_configs（后台可配置，不再依赖 .env）。
// 未启用面板 → 200 + { configured:false, enabled:false }（前端按开关隐藏，不算错误）
// 已启用但未配置凭据 → 200 + { configured:false, enabled:true }
// 拉取失败         → 502 + { configured:true, error:true, message }
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const row = db
    .prepare(
      `SELECT sensenova_enabled, sensenova_username, sensenova_password,
              sensenova_account_id, sensenova_token_key
       FROM user_configs WHERE user_id = ?`,
    )
    .get(user.id) as
    | {
        sensenova_enabled: number;
        sensenova_username: string;
        sensenova_password: string;
        sensenova_account_id: string;
        sensenova_token_key: string;
      }
    | undefined;

  const enabled = row?.sensenova_enabled === 1;
  const username = row?.sensenova_username?.trim();
  const password = decryptSecret(row?.sensenova_password?.trim() || "");
  const accountId = row?.sensenova_account_id?.trim() || undefined;
  const tokenKey = decryptSecret(row?.sensenova_token_key?.trim() || "") || undefined;

  if (!enabled) {
    return NextResponse.json({
      configured: false,
      enabled: false,
      models: [],
      timestamp: "",
      account_id: "",
      message: "商汤用量面板未启用（后台设置中开启）",
    });
  }

  if (!username || !password) {
    return NextResponse.json({
      configured: false,
      enabled: true,
      models: [],
      timestamp: "",
      account_id: "",
      message: "尚未在后台配置商汤凭据",
    });
  }

  try {
    const data: UsageResponse = await getUsage({
      username,
      password,
      accountId,
      cacheToken: true,
      tokenKey,
    });
    return NextResponse.json({ configured: true, enabled: true, ...data });
  } catch (err) {
    console.error("[sensenova/usage] 获取用量失败:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        configured: true,
        enabled: true,
        error: true,
        models: [],
        timestamp: "",
        account_id: accountId ?? "",
        message,
      },
      { status: 502 },
    );
  }
}
