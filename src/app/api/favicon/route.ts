import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { fetchWebsiteIcon } from "@/lib/favicon";

async function GETHandler(req: Request) {
  if (!await getSessionUser()) return localizedJson({ error: "未登录" }, { status: 401 });
  const rawUrl = new URL(req.url).searchParams.get("url") || "";
  let pageUrl: URL;
  try { pageUrl = new URL(rawUrl); }
  catch { return localizedJson({ error: "无效的网址" }, { status: 400 }); }
  if (!["http:", "https:"].includes(pageUrl.protocol)) {
    return localizedJson({ error: "仅支持 http/https 网址" }, { status: 400 });
  }
  const icon = await fetchWebsiteIcon(pageUrl);
  return icon ? NextResponse.json(icon)
    : NextResponse.json({ error: "未找到可用的网站图标，请检查网址或上传图标" }, { status: 502 });
}

export const GET = withRequestLogging("/api/favicon", GETHandler);
