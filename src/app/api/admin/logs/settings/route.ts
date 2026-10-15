import { requireAdmin } from "@/lib/auth";
import { localizedJson } from "@/lib/localized-json";
import { readLogSettings } from "@/lib/logging/settings";
import { updateLogSettings } from "@/lib/logging/management";
import type { NextRequest } from "next/server";
export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return localizedJson({ error: "需要管理员权限" }, { status: 403 });
  return localizedJson({ settings: readLogSettings() });
}
export async function PATCH(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return localizedJson({ error: "需要管理员权限" }, { status: 403 });
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || !("settings" in body)) throw new Error("Invalid settings");
    return localizedJson({ settings: updateLogSettings(user.id, body.settings, "token" in body && typeof body.token === "string" ? body.token : undefined) });
  } catch { return localizedJson({ error: "日志设置无效，缩短审计保留期需要重新预览并确认" }, { status: 400 }); }
}
