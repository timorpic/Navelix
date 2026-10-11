import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { checkCSRF } from "@/lib/csrf";
import { db } from "@/lib/db";
import { getGlobalConfigRow } from "@/lib/global-config";
import { mapUserConfigRow, GLOBAL_SCOPE_CONFIG_KEYS } from "@/lib/user-config-columns";
import { validateConfigPatch } from "@/lib/config-validation";
import { saveUserConfigs } from "@/lib/user-data";
import { getProFeatureFlags } from "@/lib/ee-gate";

export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return NextResponse.json({ error: "仅管理员可访问" }, { status: 403 });
  const config = mapUserConfigRow(getGlobalConfigRow());
  return NextResponse.json({ config: Object.fromEntries(Object.entries(config).filter(([key]) => GLOBAL_SCOPE_CONFIG_KEYS.has(key) || key === "aiKeyConfigured" || key === "weatherKeyConfigured")) });
}
export async function PATCH(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return NextResponse.json({ error: "仅管理员可访问" }, { status: 403 });
  const csrf = checkCSRF(req);
  if (!csrf.success) return NextResponse.json({ error: csrf.error }, { status: csrf.status || 403 });
  let patch: unknown;
  try {
    patch = await req.json(); validateConfigPatch(patch);
    if (Object.keys(patch).some(key => !GLOBAL_SCOPE_CONFIG_KEYS.has(key))) throw new Error("仅支持系统配置字段");
    const flags = getProFeatureFlags();
    for (const key of Object.keys(patch)) {
      if ((!flags.hasBrandCustom && ["logoText", "logoImage", "siteTitle"].includes(key)) ||
          (!flags.hasCodeInject && ["customHeadScripts", "customCss"].includes(key)) ||
          (!flags.hasProbes && ["linkStatusEnabled", "linkStatusInterval"].includes(key))) throw new Error("该设置需要 Pro 授权");
    }
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "无效配置" }, { status: 400 }); }
  db.exec("BEGIN IMMEDIATE");
  try {
    saveUserConfigs(user.id, patch);
    db.exec("COMMIT");
  } catch { db.exec("ROLLBACK"); return NextResponse.json({ error: "保存失败" }, { status: 500 }); }
  return GET(req);
}
