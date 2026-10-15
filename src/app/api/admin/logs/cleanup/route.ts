import { requireAdmin } from "@/lib/auth";
import { localizedJson } from "@/lib/localized-json";
import { executeCleanup } from "@/lib/logging/management";
import type { NextRequest } from "next/server";
export async function POST(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return localizedJson({ error: "需要管理员权限" }, { status: 403 });
  try { const body = await req.json(); return localizedJson(executeCleanup(user.id, String(body.token ?? ""))); }
  catch { return localizedJson({ error: "清理预览已失效，请重新预览" }, { status: 400 }); }
}
