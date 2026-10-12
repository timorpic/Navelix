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

export async function GET() {
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

export async function POST(req: NextRequest) {
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

  saveLicenseKey(key);

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

export async function DELETE() {
  const user = await requireAdmin();
  if (!user) {
    return localizedJson({ error: "需要管理员权限" }, { status: 403 });
  }

  removeLicenseKey();

  return localizedJson({
    success: true,
    isPro: false,
    machineFingerprint: getMachineFingerprint(),
    message: "许可证已注销",
  });
}
