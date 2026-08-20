import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { safeFetch } from "@/lib/ssrf";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_ICON_BYTES = 1_000_000;
const REALISTIC_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  return await safeFetch(url, {
    ...init,
    timeoutMs: FETCH_TIMEOUT_MS,
    allowPrivateIPs: true, // 允许抓取用户配置的内网设备/NAS/路由器/开发服务图标
    headers: {
      "User-Agent": REALISTIC_USER_AGENT,
      ...(init?.headers || {}),
    },
  });
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
    let html = "";
    try {
      const pageRes = await fetchWithTimeout(pageUrl.toString(), {
        redirect: "follow",
      });
      if (pageRes.ok) {
        html = (await pageRes.text()).slice(0, 512 * 1024);
      }
    } catch {
      // 访问主页解析 HTML 失败时继续尝试直接获取 /favicon.ico
    }

    const iconUrl =
      resolveIconHref(html, pageUrl) || `${pageUrl.origin}/favicon.ico`;
    const resolved = await resolveIcon(iconUrl);

    // 如果首选图标解析无 dataUrl 且不是默认 /favicon.ico，回退尝试默认 /favicon.ico
    if (!resolved.dataUrl && iconUrl !== `${pageUrl.origin}/favicon.ico`) {
      const fallback = await resolveIcon(`${pageUrl.origin}/favicon.ico`);
      if (fallback.dataUrl) return NextResponse.json(fallback);
    }

    return NextResponse.json(resolved);
  } catch {
    return NextResponse.json(
      { error: "无法访问该网站，请检查网址是否可达" },
      { status: 502 },
    );
  }
}