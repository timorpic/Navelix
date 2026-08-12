import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_ICON_BYTES = 1_000_000;

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// 从 HTML 中提取 <link rel="icon"> 等图标声明
function resolveIconHref(html: string, base: URL): string | null {
  const linkTags = html.match(/<link[^>]+rel\s*=\s*["'][^"']*icon[^"']*["'][^>]*>/gi);
  if (!linkTags) return null;

  for (const tag of linkTags) {
    const hrefMatch = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch?.[1]) continue;
    try {
      return new URL(hrefMatch[1], base).toString();
    } catch {
      // 忽略无法解析的相对地址，继续找下一个
    }
  }
  return null;
}

// 抓取图标并尽量转成 data URL（内网/协议变更也不受影响）
async function resolveIcon(iconUrl: string): Promise<{
  dataUrl: string | null;
  iconUrl: string;
}> {
  try {
    const res = await fetchWithTimeout(iconUrl);
    if (!res.ok) throw new Error("bad status");
    const type =
      res.headers.get("content-type")?.split(";")[0]?.trim() ||
      "image/x-icon";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_ICON_BYTES) throw new Error("icon too large");
    return {
      dataUrl: `data:${type};base64,${buf.toString("base64")}`,
      iconUrl,
    };
  } catch {
    // 抓取失败时退回原始图标地址，由前端决定是否使用
    return { dataUrl: null, iconUrl };
  }
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("url") || "";

  let pageUrl: URL;
  try {
    pageUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "无效的网址" }, { status: 400 });
  }
  if (pageUrl.protocol !== "http:" && pageUrl.protocol !== "https:") {
    return NextResponse.json(
      { error: "仅支持 http/https 网址" },
      { status: 400 },
    );
  }

  try {
    const pageRes = await fetchWithTimeout(pageUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Navelix favicon fetcher)",
      },
      redirect: "follow",
    });
    const html = pageRes.ok
      ? (await pageRes.text()).slice(0, 512 * 1024)
      : "";
    const iconUrl =
      resolveIconHref(html, pageUrl) || `${pageUrl.origin}/favicon.ico`;
    return NextResponse.json(await resolveIcon(iconUrl));
  } catch {
    return NextResponse.json(
      { error: "无法访问该网站，请检查网址是否可达" },
      { status: 502 },
    );
  }
}