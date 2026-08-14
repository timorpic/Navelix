import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkCSRF } from "@/lib/csrf";
import { verifyProLicenseKey } from "@/lib/license";
import { saveUserConfigs } from "@/lib/user-data";

// POST /api/auth/license - Validate PRO License Key and unlock PRO edition
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const csrfResult = checkCSRF(req);
  if (!csrfResult.success) {
    return NextResponse.json(
      { error: csrfResult.error || "CSRF 验证失败" },
      { status: csrfResult.status || 403 },
    );
  }

  try {
    const { proKey } = await req.json();
    const result = verifyProLicenseKey(proKey);

    if (!result.valid) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // Server-side verified: Save isPro=true into SQLite user_configs
    saveUserConfigs(user.id, { isPro: true });

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "验证授权密钥失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
