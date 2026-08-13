import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { safeFetch } from "@/lib/ssrf";

interface ChatHistoryItem {
  sender?: string;
  text?: string;
}

const REQUEST_TIMEOUT_MS = 30_000;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    // Read AI config from the current user's server-side settings instead of
    // trusting values sent by the client (prevents arbitrary URL fetches).
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

    const apiKey = configRow?.ai_api_key?.trim() || "";
    if (!apiKey) {
      return NextResponse.json({
        text: "💡 提示：您尚未在后台配置 AI API Key。\n请前往「后台管理控制台 -> 🎨 个性化设置」填入您的 BaseURL、API Key 与模型名称，即可开启真实大语言模型对话功能！",
      });
    }

    const baseUrl = configRow?.ai_base_url?.trim() || "https://api.openai.com/v1";
    const modelName = configRow?.ai_model?.trim() || "gpt-4o-mini";

    let parsedBaseUrl: URL;
    try {
      parsedBaseUrl = new URL(baseUrl);
    } catch {
      return NextResponse.json({
        text: "⚠️ 后台配置的 BaseURL 格式不正确，请检查后重试。",
      });
    }
    if (parsedBaseUrl.protocol !== "http:" && parsedBaseUrl.protocol !== "https:") {
      return NextResponse.json({
        text: "⚠️ BaseURL 仅支持 http/https 协议，请检查后台配置。",
      });
    }

    const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
    const targetUrl = cleanBaseUrl.endsWith("/chat/completions")
      ? cleanBaseUrl
      : `${cleanBaseUrl}/chat/completions`;

    // Format OpenAI standard messages payload
    const systemMessage = {
      role: "system",
      content: "你是由 Navelix 数字导航工作空间集成的 AI 智能助手。请解答用户的疑问，使用简洁、清晰且富有条理的中文回答。",
    };

    const messages = [
      systemMessage,
      ...(history as ChatHistoryItem[]).map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: String(m.text ?? ""),
      })),
      { role: "user", content: prompt },
    ];

    let response: Response;
    try {
      response = await safeFetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          temperature: 0.7,
        }),
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
    } catch (err) {
      const isSsrf = err instanceof Error && err.message.includes("SSRF_BLOCKED");
      const timedOut = err instanceof Error && (err.name === "AbortError" || err.message.includes("TIMEOUT"));
      return NextResponse.json({
        text: isSsrf
          ? "⚠️ 安全拦截：配置的 BaseURL 为内部/私有 IP 地址，禁止访问。"
          : timedOut
            ? "⚠️ API 请求超时，请检查 BaseURL 网络连接或稍后重试。"
            : `⚠️ 网络异常：${err instanceof Error ? err.message : "无法连接到指定的 BaseURL 地址"}`,
      });
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return NextResponse.json(
        {
          text: `⚠️ API 请求失败 (${response.status})：${
            errText || response.statusText
          }\n请检查后台配置的 BaseURL 和 API Key 是否正确。`,
        },
        { status: 200 },
      );
    }

    const data = await response.json();
    const aiContent =
      data.choices?.[0]?.message?.content ||
      "AI 响应内容为空，请稍后重试。";

    return NextResponse.json({ text: aiContent });
  } catch (err) {
    return NextResponse.json(
      {
        text: `⚠️ 网络异常：${err instanceof Error ? err.message : "无法连接到指定的 BaseURL 地址"}`,
      },
      { status: 200 },
    );
  }
}
