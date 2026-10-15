import { requireAdmin } from "@/lib/auth";
import { localizedJson } from "@/lib/localized-json";
import { previewCleanup } from "@/lib/logging/management";
import type { NextRequest } from "next/server";
export async function POST(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return localizedJson({ error: "需要管理员权限" }, { status: 403 });
  try { const body = await req.json(); return localizedJson(previewCleanup(user.id, body.settings ?? {})); }
  catch { return localizedJson({ error: "无法生成日志清理预览" }, { status: 400 }); }
}
