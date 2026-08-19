import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkCSRF } from "@/lib/csrf";
import {
  getAntigravityClientSecret,
  isCustomAntigravityClientSecretConfigured,
  setAntigravityClientSecret,
} from "@/lib/system-settings";

async function requireAdmin(req?: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdmin(req);
  if (!adminUser) {
    return NextResponse.json({ error: "无权访问，仅管理员可查看系统配置" }, { status: 403 });
  }
  return NextResponse.json({
    antigravityClientSecretConfigured: getAntigravityClientSecret().length > 0,
    isCustomSecret: isCustomAntigravityClientSecretConfigured(),
  });
}

export async function PUT(req: NextRequest) {
  const adminUser = await requireAdmin(req);
  if (!adminUser) {
    return NextResponse.json({ error: "无权访问，仅管理员可修改系统配置" }, { status: 403 });
  }

  const csrfResult = checkCSRF(req);
  if (!csrfResult.success) {
    return NextResponse.json(
      { error: csrfResult.error || "CSRF 验证失败" },
      { status: csrfResult.status || 403 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const secret = typeof body.antigravityClientSecret === "string" ? body.antigravityClientSecret : undefined;
  if (secret === undefined) {
    return NextResponse.json({ error: "缺少 antigravityClientSecret 字段" }, { status: 400 });
  }
  setAntigravityClientSecret(secret);
  return NextResponse.json({
    success: true,
    antigravityClientSecretConfigured: getAntigravityClientSecret().length > 0,
    isCustomSecret: isCustomAntigravityClientSecretConfigured(),
  });
}