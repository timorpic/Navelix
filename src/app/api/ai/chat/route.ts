import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { safeFetch } from "@/lib/ssrf";
import { decryptSecret } from "@/lib/secret";
import {
  executeAiTool,
  extractToolCalls,
  isDestructiveTool,
  stageDelete,
  consumePendingDelete,
  stripToolCalls,
} from "@/lib/ai-tools";
import { track } from "@/lib/analytics";

interface ChatHistoryItem {
  sender?: string;
  text?: string;
}

const REQUEST_TIMEOUT_MS = 30_000;

interface ProjectRow {
  id: string;
  name: string;
  status: string;
  url?: string;
}

interface TodoRow {
  id: string;
  title: string;
  priority: string;
  done: number;
  due_date?: string;
}

interface LinkRow {
  title: string;
  url: string;
  category: string;
  description?: string;
  is_quick_access?: number;
}

interface CategoryRow {
  name: string;
  label: string;
}

// 构建用户实时工作区上下文提示词
function buildWorkspaceContext(userId: string): string {
  try {
    // 1. 读取分类映射表
    const categoryRows = db
      .prepare(`SELECT name, label FROM user_categories WHERE user_id = ?`)
      .all(userId) as unknown as CategoryRow[];
    const categoryMap: Record<string, string> = {};
    for (const c of categoryRows) {
      categoryMap[c.name] = c.label || c.name;
    }

    // 2. 读取项目 (projects)
    const projects = db
      .prepare(
        `SELECT id, name, status, url
         FROM projects
         WHERE user_id = ?
         ORDER BY sort_order ASC
         LIMIT 50`,
      )
      .all(userId) as unknown as ProjectRow[];

    // 3. 读取待办 (user_todos)
    const todos = db
      .prepare(
        `SELECT id, title, priority, done, due_date
         FROM user_todos
         WHERE user_id = ?
         ORDER BY done ASC,
                  CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC,
                  sort_order ASC
         LIMIT 50`,
      )
      .all(userId) as unknown as TodoRow[];

    // 4. 读取常用书签与快捷导航 (user_links)
    const links = db
      .prepare(
        `SELECT title, url, category, description, is_quick_access
         FROM user_links
         WHERE user_id = ?
         ORDER BY is_quick_access DESC
         LIMIT 60`,
      )
      .all(userId) as unknown as LinkRow[];

    const projectLines = projects.length > 0
      ? projects.map((p) => {
          return `- [${p.status || "状态未填"}] (id: ${p.id}) 项目名称：${p.name}${p.url ? ` (链接: ${p.url})` : ""}`;
        }).join("\n")
      : "（当前暂无项目数据）";

    const todoLines = todos.length > 0
      ? todos.map((t) => {
          const statusText = t.done === 1 ? "已完成" : "未完成";
          const prioText = t.priority === "high" ? "高优先级" : t.priority === "medium" ? "中优先级" : "普通优先级";
          return `- [${statusText} | ${prioText}] (id: ${t.id}) 待办：${t.title}${t.due_date ? ` (截止日期: ${t.due_date})` : ""}`;
        }).join("\n")
      : "（当前暂无待办事项）";

    const linkLines = links.length > 0
      ? links.slice(0, 35).map((l) => {
          const catLabel = categoryMap[l.category] || l.category || "常用";
          return `- [${catLabel}] ${l.title} (${l.url})${l.description ? ` - ${l.description}` : ""}${l.is_quick_access ? " [快捷访问]" : ""}`;
        }).join("\n")
      : "（当前暂无收藏书签）";

    return `你是由 Navelix 个人数字化工作空间深度集成的 AI 智能助手。
你拥有直接感知当前用户工作区数据的专属权限（已实时加载当前用户的项目列表、待办清单及书签链接）。请根据用户的真实工作区数据，使用亲切、简洁、清晰且富有条理的中文回答用户的所有问题。

=== 用户的 Navelix 实时工作区数据 ===

【📌 项目列表 (Projects)】：
${projectLines}

【✅ 待办清单 (Todos)】：
${todoLines}

【🔗 常用网址书签 (Bookmarks)】：
${linkLines}

【核心指令与回答准则】：
1. 当用户询问项目（如“我有哪些已完成的项目”、“正在进行的项目”等）、待办任务或书签时，必须直接提取上述数据回答，绝不能回答“我没有权限访问您的数据”或“我不知道您的项目”。
2. 若用户询问已完成项目，请明确列出状态为“已完成”的所有项目名称及相关信息。
3. 若用户请求工作建议、任务拆解或优先级规划，请结合上述进行中的项目与待办清单给出针对性方案。

【可执行的写操作工具 (Tool Calling)】：
当用户明确要求你创建、修改或删除“待办/日程”或“项目”时，你可以在回复中追加一个或多个工具调用块，格式必须严格如下：
<TOOL>{"tool":"create_todo","args":{"title":"待办标题","priority":"high|medium|low","dueDate":"YYYY-MM-DD"}}</TOOL>

可用工具清单：
1. create_todo —— 新建待办/日程。args: { title: string 必填, priority?: high|medium|low, dueDate?: YYYY-MM-DD, projectId?: string }
2. update_todo —— 修改待办。args: { id: string 必填, title?: string, priority?: string, dueDate?: string, done?: boolean }
3. delete_todo —— 删除待办。args: { id: string 必填 }
4. create_project —— 新建项目。args: { name: string 必填, status?: string, color?: string, url?: string, description?: string }
5. update_project —— 修改项目。args: { id: string 必填, name?: string, status?: string, color?: string, url?: string, description?: string }
6. delete_project —— 删除项目。args: { id: string 必填 }

工具调用规则：
- 只有在用户明确表达“创建/修改/删除”意图时才输出工具调用块；普通查询不要输出。
- 每个工具调用块独立放在一行，可以连续输出多个。
- 在正文中简要说明你将要执行的操作，再把 <TOOL> 块追加在回复末尾。
- 删除操作（delete_todo / delete_project）不会被立即执行：系统会先暂存并向用户请求二次确认，用户在回复中明确「确认删除」后才会真正删除。你在正文中只需说明将删除的目标，不需要用户现在回复确认。
- 不要编造待办或项目的 id；若需要修改/删除特定项，从上方工作区数据中引用其真实 id（若未提供，可要求用户说明要操作的是哪一项）。`;
  } catch (e) {
    console.error("[AI Chat] Failed to build workspace context:", e);
    return "你是由 Navelix 数字导航工作空间集成的 AI 智能助手。请解答用户的疑问，使用简洁、清晰且富有条理的中文回答。";
  }
}

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

    // 若用户回复是对上一条删除请求的二次确认，直接执行暂存的删除，不再调用模型
    const confirmedDelete = consumePendingDelete(user.id, prompt);
    if (confirmedDelete) {
      return NextResponse.json({
        text: confirmedDelete.ok
          ? `✅ ${confirmedDelete.message}`
          : `❌ ${confirmedDelete.error}`,
      });
    }

    // Read AI config from the current user's server-side settings
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
    if (!apiKey) {
      return NextResponse.json({
        text: "💡 提示：您尚未在后台配置 AI API Key。\n请前往「后台管理控制台 -> 🎨 界面与功能偏好」填入您的 BaseURL、API Key 与模型名称，即可开启真实大语言模型对话功能！",
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

    // 动态生成注入了当前用户真实项目/待办/书签的系统上下文
    const systemPromptContent = buildWorkspaceContext(user.id);
    const systemMessage = {
      role: "system",
      content: systemPromptContent,
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
        allowPrivateIPs: true,
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

    const data = await response.json().catch(() => null);
    const replyText =
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.text ||
      "未获取到有效的模型回复。";

    // 解析并执行 AI 请求的写操作工具调用
    // 删除类工具（delete_*）不直接执行，先暂存等待用户二次确认，防止 Prompt Injection 误删
    const toolCalls = extractToolCalls(replyText);
    const cleanText = stripToolCalls(replyText);
    let toolReport = "";
    if (toolCalls.length > 0) {
      const lines: string[] = [];
      for (const call of toolCalls) {
        if (isDestructiveTool(call.tool)) {
          const result = stageDelete(user.id, call);
          if ("needsConfirmation" in result) {
            lines.push(`⚠️ ${result.message}`);
          } else if (result.ok) {
            lines.push(`✅ ${result.message}`);
          } else {
            lines.push(`❌ ${result.error}`);
          }
        } else {
          const result = executeAiTool(user.id, call);
          lines.push(result.ok ? `✅ ${result.message}` : `❌ ${result.error}`);
        }
      }
      toolReport = `\n\n${lines.join("\n")}`;
    }

    // 可选遥测：AI 对话（规范 wiki/Analytics §4.2）
    track("ai.chat_sent", {
      userId: user.id,
      meta: { contextSize: systemPromptContent.length > 0 ? 1 : 0, hadError: false },
    });

    return NextResponse.json({
      text: `${cleanText || (toolReport ? "已执行您的请求：" : "未获取到有效的模型回复。")}${toolReport}`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        text: `⚠️ 服务异常：${
          err instanceof Error ? err.message : "处理请求时发生内部错误"
        }`,
      },
      { status: 500 },
    );
  }
}
