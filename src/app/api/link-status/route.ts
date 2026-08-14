import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { safeFetch } from "@/lib/ssrf";

const TIMEOUT_MS = 8_000;
const MAX_URLS = 20;
const REALISTIC_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function checkUrl(url: string): Promise<"online" | "offline"> {
  try {
    const res = await safeFetch(url, {
      method: "GET",
      timeoutMs: TIMEOUT_MS,
      allowPrivateIPs: true, // 允许检测用户内网 NAS / 路由器 / 开发服务连通状态
      cache: "no-store",
      headers: {
        "User-Agent": REALISTIC_USER_AGENT,
      },
    });
    // 只要 HTTP 状态码在 200-499 之间（包含 2xx, 3xx 重定向, 401 需认证, 403 拒绝访问, 405 等），说明目标服务网络可达（online）
    if (res.status >= 200 && res.status < 500) {
      return "online";
    }
    return "offline";
  } catch {
    return "offline";
  }
}

// 服务端代理连通性检测，避免浏览器跨域请求触发 CORB 拦截
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
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

  const results = await Promise.all(
    valid.map(async (url) => ({ url, status: await checkUrl(url) })),
  );
  return NextResponse.json({ results });
}
