import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listMonitorAccounts } from "@/lib/monitor/accounts";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  return NextResponse.json({ accounts: listMonitorAccounts(user.id) });
}