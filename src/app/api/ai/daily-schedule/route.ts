import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { safeFetch } from "@/lib/ssrf";
import { toLocalDateStr } from "@/lib/date-utils";

const REQUEST_TIMEOUT_MS = 25_000;

interface ScheduledTask {
  title: string;
  priority: "high" | "medium" | "low";
  dueDate: string;
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const targetDate = typeof body?.date === "string" && body.date.trim()
      ? body.date.trim()
      : toLocalDateStr();

    // 1. 获取当前用户未完成的项目和待办作为上下文
    const pendingTodos = db
      .prepare(
        "SELECT title, priority, due_date FROM user_todos WHERE user_id = ? AND done = 0 ORDER BY created_at DESC LIMIT 10",
      )
      .all(user.id) as Array<{ title: string; priority: string; due_date: string }>;

    const activeProjects = db
      .prepare(
        "SELECT name, status FROM projects WHERE user_id = ? AND status != '已完成' LIMIT 5",
      )
      .all(user.id) as Array<{ name: string; status: string }>;

    // 2. 读取当前用户的 AI 配置
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
    const baseUrl = configRow?.ai_base_url?.trim() || "https://api.openai.com/v1";
    const modelName = configRow?.ai_model?.trim() || "gpt-4o-mini";

    // 规则智能生成器 (保障无 Key 或网络故障时 100% 顺畅工作)
    const generateFallback = () => {
      const tasks: ScheduledTask[] = [];
      if (activeProjects.length > 0) {
        tasks.push({
          title: `【深度专注】推进项目「${activeProjects[0].name}」核心阶段开发`,
          priority: "high",
          dueDate: targetDate,
        });
      } else {
        tasks.push({
          title: `【深度专注】数字化工作空间系统架构梳理与攻坚`,
          priority: "high",
          dueDate: targetDate,
        });
      }

      tasks.push({
        title: `【协同推进】接口联调、验证测试与边缘异常排查`,
        priority: "medium",
        dueDate: targetDate,
      });

      tasks.push({
        title: `【复盘沉淀】整理今日知识笔记与服务器备份检查`,
        priority: "low",
        dueDate: targetDate,
      });

      return {
        advice: `💡 建议在上午精力充沛时集中攻坚重点项目任务，下午进行协同联调，晚上完成工作区整理与复盘。`,
        tasks,
      };
    };

    if (!apiKey) {
      const fallback = generateFallback();
      return NextResponse.json({
        success: true,
        source: "smart_rules",
        advice: fallback.advice,
        tasks: fallback.tasks,
      });
    }

    // 3. 调用 AI 大模型进行结构化排程
    const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
    const targetUrl = cleanBaseUrl.endsWith("/chat/completions")
      ? cleanBaseUrl
      : `${cleanBaseUrl}/chat/completions`;

    const systemPrompt = `你是一位高阶时间管理教练与敏捷日程架构师。
请针对指定目标日期（${targetDate}），结合用户当前正在进行的项目与待办，规划 3 到 4 项按精力时段递进的今日执行任务。

必须输出严格 JSON 对象，不要输出 markdown 格式代码块，格式如下：
{
  "advice": "简要的今日精力分配与执行策略建议（50字以内）",
  "tasks": [
    {
      "title": "具体任务名称（简明扼要，建议带上【上午专注】或【下午推进】等标记）",
      "priority": "high",
      "dueDate": "${targetDate}"
    }
  ]
}`;

    const contextSummary = `指定排程日期：${targetDate}
当前进行中的项目：${activeProjects.map((p) => p.name).join("、") || "暂无特定项目"}
已有未完成待办：${pendingTodos.map((t) => t.title).join("、") || "暂无未完成待办"}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await safeFetch(
        targetUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: contextSummary },
            ],
            temperature: 0.3,
            max_tokens: 800,
          }),
          signal: controller.signal,
        },
        { allowPrivateIPs: true },
      );

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`AI Gateway error ${response.status}`);
      }

      const aiData = await response.json();
      const raw = aiData?.choices?.[0]?.message?.content || "";
      let cleaned = raw.trim();
      if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
      if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
      if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
      cleaned = cleaned.trim();

      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed?.tasks) && parsed.tasks.length > 0) {
        const validatedTasks: ScheduledTask[] = parsed.tasks.map((t: { title?: string; priority?: string }) => ({
          title: String(t.title || "今日执行任务").trim(),
          priority: t.priority === "high" || t.priority === "low" ? t.priority : "medium",
          dueDate: targetDate,
        }));

        return NextResponse.json({
          success: true,
          source: "ai_model",
          advice: parsed.advice || "已为您根据当前工作区状态生成今日最佳执行排期。",
          tasks: validatedTasks,
        });
      }

      throw new Error("Invalid format");
    } catch {
      const fallback = generateFallback();
      return NextResponse.json({
        success: true,
        source: "smart_rules_fallback",
        advice: fallback.advice,
        tasks: fallback.tasks,
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "智能排程失败" },
      { status: 500 },
    );
  }
}
