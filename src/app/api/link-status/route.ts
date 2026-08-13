import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { safeFetch } from "@/lib/ssrf";

const TIMEOUT_MS = 8_000;
const MAX_URLS = 20;

async function checkUrl(url: string): Promise<"online" | "offline"> {
  try {
    let res = await safeFetch(url, {
      method: "HEAD",
      timeoutMs: TIMEOUT_MS,
      cache: "no-store",
    });
    // 部分站点不支持 HEAD，回退为 GET 探测
    if (res.status === 405 || res.status === 501) {
      res = await safeFetch(url, {
        method: "GET",
        timeoutMs: TIMEOUT_MS,
        cache: "no-store",
      });
    }
    return res.ok ? "online" : "offline";
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
