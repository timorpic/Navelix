import { auditedTransaction } from "@/lib/logging/transaction";
import { recordAuditLog } from "@/lib/audit";
import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { getEEDriverStatus } from "@/lib/ee-bridge";
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  getLicenseStatus,
  saveLicenseKey,
  removeLicenseKey,
  verifyLicenseKey,
} from "@/lib/license";
import { getMachineFingerprint } from "@/lib/fingerprint";
import { getBuildInfo } from "@/lib/build-info";

async function GETHandler() {
  const user = await requireAdmin();
  if (!user) {
    return localizedJson({ error: "需要管理员权限" }, { status: 403 });
  }

  const status = getLicenseStatus();
  const machineFingerprint = getMachineFingerprint();
  const buildInfo = getBuildInfo();
  return localizedJson({
    ...status,
    machineFingerprint,
    isDockerBuild: buildInfo.isDockerBuild,
    eeDriverStatus: getEEDriverStatus(),
  });
}

async function POSTHandler(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return localizedJson({ error: "需要管理员权限" }, { status: 403 });
  }

  let body: { licenseKey?: unknown };
  try {
    body = await req.json();
  } catch {
    return localizedJson({ error: "请求数据格式错误" }, { status: 400 });
  }

  const key = typeof body.licenseKey === "string" ? body.licenseKey.trim() : "";
  if (!key) {
    return localizedJson({ error: "License Key 不能为空" }, { status: 400 });
  }

  const verifyRes = verifyLicenseKey(key);
  if (!verifyRes.valid) {
    return localizedJson(
      { error: verifyRes.error || "许可证无效或签名错误" },
      { status: 400 },
    );
  }

  auditedTransaction(() => { saveLicenseKey(key); recordAuditLog({ userId: user.id, action: "license.activated" }); });

  const status = getLicenseStatus();
  const buildInfo = getBuildInfo();

  return localizedJson({
    success: true,
    ...status,
    machineFingerprint: getMachineFingerprint(),
    isDockerBuild: buildInfo.isDockerBuild,
    eeDriverStatus: getEEDriverStatus(),
  });
}

async function DELETEHandler() {
  const user = await requireAdmin();
  if (!user) {
    return localizedJson({ error: "需要管理员权限" }, { status: 403 });
  }

  auditedTransaction(() => { removeLicenseKey(); recordAuditLog({ userId: user.id, action: "license.removed" }); });

  return localizedJson({
    success: true,
    isPro: false,
    machineFingerprint: getMachineFingerprint(),
    message: "许可证已注销",
  });
}

export const GET = withRequestLogging("/api/admin/license", GETHandler);
export const POST = withRequestLogging("/api/admin/license", POSTHandler);
export const DELETE = withRequestLogging("/api/admin/license", DELETEHandler);
