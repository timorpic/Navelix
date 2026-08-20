import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getLicenseStatus,
  saveLicenseKey,
  removeLicenseKey,
  verifyLicenseKey,
} from "@/lib/license";
import { getMachineFingerprint } from "@/lib/fingerprint";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  const status = getLicenseStatus();
  const machineFingerprint = getMachineFingerprint();
  return NextResponse.json({ ...status, machineFingerprint });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  let body: { licenseKey?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求数据格式错误" }, { status: 400 });
  }

  const key = typeof body.licenseKey === "string" ? body.licenseKey.trim() : "";
  if (!key) {
    return NextResponse.json({ error: "License Key 不能为空" }, { status: 400 });
  }

  const verifyRes = verifyLicenseKey(key);
  if (!verifyRes.valid) {
    return NextResponse.json(
      { error: verifyRes.error || "许可证无效或签名错误" },
      { status: 400 },
    );
  }

  saveLicenseKey(key);

  return NextResponse.json({
    success: true,
    isPro: true,
    payload: verifyRes.payload,
    machineFingerprint: getMachineFingerprint(),
  });
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  removeLicenseKey();

  return NextResponse.json({
    success: true,
    isPro: false,
    machineFingerprint: getMachineFingerprint(),
    message: "许可证已注销，系统已切换为开源社区版",
  });
}
