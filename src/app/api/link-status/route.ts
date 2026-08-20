import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessFeature, getLicenseStatus } from "@/lib/license";
import { getProbeDriver, isEEAvailable, CE_PRO_MESSAGE } from "@/lib/ee-bridge";

const MAX_URLS = 25;

// 服务端代理连通性与网络延迟探测 (Pro 专享 · 需官方 EE 驱动)
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  // 1. 检查 EE 商业驱动是否安装
  if (!isEEAvailable()) {
    return NextResponse.json(
      { error: "EE_DRIVER_MISSING", message: CE_PRO_MESSAGE, results: [] },
      { status: 403 },
    );
  }

  // 2. 严格 Pro 商业权限拦截：未激活 Pro 拒绝探测并返回空
  const isAllowed = canAccessFeature("link_latency_probe") || getLicenseStatus().isPro;
  if (!isAllowed) {
    return NextResponse.json(
      { error: "PRO_REQUIRED", message: "书签实时网络延迟与健康存活探针为 Pro 专享功能，请先激活 Pro 许可证", results: [] },
      { status: 403 },
    );
  }

  const urls = req.nextUrl.searchParams
    .getAll("url")
    .map((u) => u.trim())
    .filter(Boolean);
  if (urls.length === 0 || urls.length > MAX_URLS) {
    return NextResponse.json({ error: "无效的请求参数" }, { status: 400 });
  }

  const valid: string[] = [];
  for (const u of urls) {
    try {
      const parsed = new URL(u);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        valid.push(u);
      }
    } catch {
      // 忽略无法解析的地址
    }
  }

  const results = await getProbeDriver().probeUrls(valid);
  return NextResponse.json({ results });
}

