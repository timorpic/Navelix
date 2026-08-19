import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkCSRF } from "@/lib/csrf";
import { refreshMonitorAccount } from "@/lib/monitor/accounts";

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

  let body: { id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "缺少账号 id" }, { status: 400 });
  }

  try {
    const account = await refreshMonitorAccount(user.id, id);
    return NextResponse.json({ account });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}