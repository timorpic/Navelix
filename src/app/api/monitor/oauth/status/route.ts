import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getOAuthSession } from "@/lib/monitor/oauth";
import { listMonitorAccounts, getMonitorAccount } from "@/lib/monitor/accounts";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const state = req.nextUrl.searchParams.get("state") || "";
  if (!state) {
    return NextResponse.json({ error: "缺少 state" }, { status: 400 });
  }

  const session = getOAuthSession(state);
  if (!session) {
    return NextResponse.json({ status: "expired" });
  }
  if (session.userId !== user.id) {
    return NextResponse.json({ error: "无权访问该会话" }, { status: 403 });
  }

  if (session.status === "pending") {
    return NextResponse.json({ status: "pending" });
  }
  if (session.status === "error") {
    return NextResponse.json({ status: "error", error: session.error || "授权失败" });
  }

  const account = session.accountId ? getMonitorAccount(user.id, session.accountId) : undefined;
  return NextResponse.json({
    status: "done",
    accountId: session.accountId,
    accounts: listMonitorAccounts(user.id),
    freshAccount: account
      ? {
          id: account.id,
          provider: account.provider,
          email: account.email,
          label: account.label,
          planType: account.plan_type,
          subscriptionStart: account.subscription_start,
          subscriptionUntil: account.subscription_until,
        }
      : null,
  });
}