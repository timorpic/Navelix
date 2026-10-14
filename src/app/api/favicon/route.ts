import { validateHostIPs } from "@/lib/ssrf";
import { localizedJson } from "@/lib/localized-json";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { fetchWebsiteIcon } from "@/lib/favicon";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return localizedJson({ error: "未登录" }, { status: 401 });

  const rawUrl = new URL(req.url).searchParams.get("url") || "";
  let pageUrl: URL;
  try { pageUrl = new URL(rawUrl); }
  catch { return localizedJson({ error: "无效的网址" }, { status: 400 }); }
  if (!["http:", "https:"].includes(pageUrl.protocol)) {
    return localizedJson({ error: "仅支持 http/https 网址" }, { status: 400 });
  }

  // 内网自建服务（NAS / 路由器 / 开发服务）需要能自动抓取图标，因此登录用户可访问
  // RFC1918 网段。回环、链路本地与云元数据（169.254.169.254）在任何模式下都由
  // ssrf.ts 无条件封禁，`localhost` / `.local` / `.internal` 域名同样拒绝；
  // 页面、声明的图标、根 favicon 与每一跳重定向都重新校验。
  try { await validateHostIPs(pageUrl.hostname, { allowPrivateIPs: true }); }
  catch { return localizedJson({ error: "不允许访问该网址" }, { status: 400 }); }

  const icon = await fetchWebsiteIcon(pageUrl, undefined, { allowPrivateIPs: true });
  return icon ? NextResponse.json(icon)
    : NextResponse.json({ error: "未找到可用的网站图标，请检查网址或上传图标" }, { status: 502 });
}
