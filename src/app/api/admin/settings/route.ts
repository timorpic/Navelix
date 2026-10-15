import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { checkCSRF } from "@/lib/csrf";
import { db } from "@/lib/db";
import { getGlobalConfigRow } from "@/lib/global-config";
import { mapUserConfigRow, GLOBAL_SCOPE_CONFIG_KEYS } from "@/lib/user-config-columns";
import { validateConfigPatch } from "@/lib/config-validation";
import { saveUserConfigs } from "@/lib/user-data";
import { getProFeatureFlags } from "@/lib/ee-gate";

async function GETHandler(req: NextRequest) {
  if (!await requireAdmin(req)) return localizedJson({ error: "仅管理员可访问" }, { status: 403 });
  const config = mapUserConfigRow(getGlobalConfigRow());
  return localizedJson({ config: Object.fromEntries(Object.entries(config).filter(([key]) => GLOBAL_SCOPE_CONFIG_KEYS.has(key) || key === "aiKeyConfigured" || key === "weatherKeyConfigured")) });
}
async function PATCHHandler(req: NextRequest) {
  const user = await requireAdmin(req);
  if (!user) return localizedJson({ error: "仅管理员可访问" }, { status: 403 });
  const csrf = checkCSRF(req);
  if (!csrf.success) return localizedJson({ error: csrf.error }, { status: csrf.status || 403 });
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
  } catch (error) { return localizedJson({ error: error instanceof Error ? error.message : "无效配置" }, { status: 400 }); }
  db.exec("BEGIN IMMEDIATE");
  try {
    saveUserConfigs(user.id, patch);
    db.exec("COMMIT");
  } catch { db.exec("ROLLBACK"); return localizedJson({ error: "保存失败" }, { status: 500 }); }
  return GETHandler(req);
}

export const GET = withRequestLogging("/api/admin/settings", GETHandler);
export const PATCH = withRequestLogging("/api/admin/settings", PATCHHandler);
