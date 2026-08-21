import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { safeFetch } from "@/lib/ssrf";
import { decryptSecret } from "@/lib/secret";

const REQUEST_TIMEOUT_MS = 20_000;

function extractTextFromHtml(html: string): string {
  // 移除 script/style/nav/footer/header 等非正文区域
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned;
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m) return m[1].replace(/<[^>]+>/g, "").trim().slice(0, 200);
  return "";
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
    if (!rawUrl) {
      return NextResponse.json({ error: "缺少 url 参数" }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return NextResponse.json({ error: "URL 格式无效" }, { status: 400 });
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return NextResponse.json({ error: "仅支持 http/https 链接" }, { status: 400 });
    }

    // 1. 抓取页面内容（safeFetch 内置 SSRF 防护）
    let pageText = "";
    let pageTitle = "";
    let fetchError = "";
    try {
      const res = await safeFetch(rawUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; NavelixBookmarkBot/1.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        },
        timeoutMs: 12_000,
        allowPrivateIPs: false,
      });
      const html = await res.text().catch(() => "");
      pageTitle = extractTitle(html);
      const extracted = extractTextFromHtml(html);
      // 控制抓取长度，避免超出模型 token 上限
      pageText = extracted.slice(0, 8000);
      if (!pageText) {
        fetchError = "未能从页面提取到正文内容（可能为动态渲染页面）。";
      }
    } catch (err) {
      const isSsrf = err instanceof Error && err.message.includes("SSRF_BLOCKED");
      fetchError = isSsrf
        ? "该网址为内网/私有地址，出于安全已拦截。"
        : `页面抓取失败：${err instanceof Error ? err.message : "网络异常"}`;
    }

    // 2. 读取 AI 配置
    const configRow = db
      .prepare(
        "SELECT ai_base_url, ai_api_key, ai_model FROM user_configs WHERE user_id = ?",
      )
      .get(user.id) as
      | {
          ai_base_url: string;
          ai_api_key: string;
          ai_model: string;
        }
      | undefined;

    const apiKey = decryptSecret(configRow?.ai_api_key?.trim() || "");
    const baseUrl = configRow?.ai_base_url?.trim() || "https://api.openai.com/v1";
    const modelName = configRow?.ai_model?.trim() || "gpt-4o-mini";

    // 3. AI 生成 Markdown 摘要（无 Key 或抓取失败时回退为纯文本摘要）
    const makeFallbackNotes = (): string => {
      const lines: string[] = [];
      if (pageTitle) lines.push(`# ${pageTitle}`);
      if (fetchError) {
        lines.push("> ⚠️ " + fetchError);
      } else if (pageText) {
        lines.push(pageText.slice(0, 500) + (pageText.length > 500 ? "…" : ""));
      }
      return lines.join("\n\n");
    };

    if (!apiKey || !pageText) {
      return NextResponse.json({ notes: makeFallbackNotes(), title: pageTitle });
    }

    const targetUrl = baseUrl.replace(/\/+$/, "").replace(/\/chat\/completions$/, "") + "/chat/completions";
    const systemPrompt = `你是一个网页内容摘要助手。请阅读下面抓取的网页正文，用简洁的中文 Markdown 格式输出要点摘要。
要求：
- 以「- 」要点列表呈现 3~6 条核心内容，涵盖页面主题、关键信息
- 开头可加一行「# 标题」概括（若无法判断标题则省略）
- 输出纯 Markdown，不要多余的前言或解释`;

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `网页标题：${pageTitle || "未知"}\n\n网页正文：\n${pageText}`,
      },
    ];

    let aiNotes = "";
    try {
      const res = await safeFetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model: modelName, messages, temperature: 0.4 }),
        timeoutMs: REQUEST_TIMEOUT_MS,
        allowPrivateIPs: true,
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        aiNotes = (data?.choices?.[0]?.message?.content || "").trim();
      }
    } catch {
      aiNotes = "";
    }

    if (aiNotes) {
      return NextResponse.json({ notes: aiNotes, title: pageTitle, generated: true });
    }
    return NextResponse.json({ notes: makeFallbackNotes(), title: pageTitle });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "内部错误" },
      { status: 500 },
    );
  }
}
