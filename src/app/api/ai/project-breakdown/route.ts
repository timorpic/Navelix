import { recordAIUsage } from "@/lib/logging/ai-usage";
import { writeLog } from "@/lib/logging/events";
import { withRequestLogging } from "@/lib/logging/request";
import { getLocale } from "next-intl/server";
import { translateText } from "@/lib/server-translations";
import { localizedJson } from "@/lib/localized-json";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { safeFetch } from "@/lib/ssrf";
import { toLocalDateStr, addDaysLocal } from "@/lib/date-utils";
import { resolveAIConfig } from "@/lib/ai-provider";
import {
  generateRuleBasedBreakdown,
  type BreakdownTask,
} from "@/lib/project-breakdown";

const REQUEST_TIMEOUT_MS = 25_000;

async function POSTHandler(req: Request) {
  const locale = await getLocale();
  const text = (value: string) => translateText(locale, value);
  const user = await getSessionUser();
  if (!user) {
    return localizedJson({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    const projectName = typeof body?.projectName === "string" ? body.projectName.trim() : "";
    const projectDescription = typeof body?.projectDescription === "string" ? body.projectDescription.trim() : "";
    const startDate = typeof body?.startDate === "string" && body.startDate.trim()
      ? body.startDate.trim()
      : toLocalDateStr();

    if (!projectName) {
      return localizedJson({ error: "项目名称不能为空" }, { status: 400 });
    }

    // 查询系统中所有注册成员列表
    const members = db
      .prepare("SELECT id, username, display_name AS displayName FROM users ORDER BY created_at ASC")
      .all() as Array<{ id: string; username: string; displayName: string }>;

    // 服务端维护 展示名 → 真实用户 ID 映射；只把展示名发给大模型，避免泄露内部 ID
    const memberById = new Map<string, string>(
      members.map((m) => [String(m.displayName || m.username).toLowerCase(), m.id]),
    );

    const currentUserName = user.displayName || user.username;
    const defaultAssignee = { id: user.id, name: currentUserName };

    // 1. 读取当前用户的 AI 配置
    // AI 配置统一解析（见 lib/ai-provider.ts）
    const { apiKey, modelName, targetUrl } = resolveAIConfig();

    // 若未配置 API Key，直接使用智能工程规则拆解
    if (!apiKey) {
      const fallback = generateRuleBasedBreakdown(projectName, startDate, defaultAssignee, locale);
      return localizedJson({
        success: true,
        source: "smart_rules",
        tasks: fallback.tasks,
        matchedCategory: fallback.matchedCategory,
        matchedKeywords: fallback.matchedKeywords,
        message: text("已使用内置敏捷拆分引擎为您智能规划日程。在后台配置 AI Key 可开启大模型专属拆解！"),
      });
    }

    // 2. 调用大模型进行深度任务拆解与排期

    const membersDesc = members.map((m) => m.displayName || m.username).join("、");

    const systemPrompt = `你是一位顶级的敏捷项目管理专家和系统架构师。
任务：请将用户提出的数字化项目拆分为 3 到 5 个递进、具体的行动里程碑任务，并为任务指派合适的团队成员。
当前排期基准日期是：${startDate}。
当前协同团队可选成员名称列表：${membersDesc || currentUserName}。

每个任务必须包含：
1. title: 任务名称（具体、明确、可执行，不超过20字）
2. priority: 优先级，必须从 "high"、"medium"、"low" 中选择
3. dueDate: 截止日期，必须为 YYYY-MM-DD 格式。请根据任务实际工作量和阶段难度合理预估工期（如前期准备 1~2 天，核心攻坚开发 3~6 天，系统联调测试 2~4 天，上线发布 1~2 天），不要机械地固定按每2天递增，要符合真实的工程交付节奏。
4. assigneeName: 推荐指派的成员名称（必须从上方的成员名称列表中精确选择一个；若没有合适的人选则返回空字符串 ""）

输出格式约束：
你必须【只】返回一个合法的 JSON 对象，不要包含 markdown 格式标记、不要输出 \`\`\`json 等代码块，直接返回纯 JSON：
{"tasks":[{"title":"任务1","priority":"high","dueDate":"${startDate}","assigneeName":"${currentUserName}"}]}`;

    const userPrompt = `项目名称：${projectName}${projectDescription ? `\n项目说明与目标：${projectDescription}` : ""}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await safeFetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: systemPrompt + (locale === "en" ? "\nOUTPUT LANGUAGE: Use English for all natural-language titles, descriptions and advice. Preserve JSON field names, priority enum values, dates and user/member names exactly." : "\n使用简体中文输出自然语言内容，保持 JSON 字段名、枚举值、日期和用户名称不变。") },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 800,
        }),
        timeoutMs: REQUEST_TIMEOUT_MS,
        allowPrivateIPs: true,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`AI Gateway responded with ${response.status}`);
      }

      const aiData = await response.json();
    recordAIUsage(aiData, modelName);
      const rawContent = aiData?.choices?.[0]?.message?.content || "";
      
      // 清洗 json 响应
      let cleaned = rawContent.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.slice(7);
      }
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.slice(3);
      }
      if (cleaned.endsWith("```")) {
        cleaned = cleaned.slice(0, -3);
      }
      cleaned = cleaned.trim();

      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed?.tasks) && parsed.tasks.length > 0) {
        const validatedTasks: BreakdownTask[] = parsed.tasks.map((t: { title?: string; priority?: string; dueDate?: string; assigneeName?: string }, idx: number) => {
          const suggestedName = String(t.assigneeName || "").trim();
          let assigneeId = "";
          let assigneeName = "";
          if (suggestedName) {
            const matchedId = memberById.get(suggestedName.toLowerCase());
            if (matchedId) {
              assigneeId = matchedId;
              assigneeName = suggestedName;
            } else {
              // 大模型返回的名称不在成员列表中：仅保留名称，不带入他人 ID
              assigneeId = user.id;
              assigneeName = suggestedName;
            }
          } else {
            assigneeId = defaultAssignee.id;
            assigneeName = defaultAssignee.name;
          }
          return {
            title: String(t.title || (locale === "en" ? `Stage task ${idx + 1}` : `阶段任务 ${idx + 1}`)).trim(),
            priority: t.priority === "high" || t.priority === "low" ? t.priority : "medium",
            dueDate: t.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) ? t.dueDate : addDaysLocal(startDate, (idx + 1) * 3),
            assigneeId,
            assigneeName,
          };
        });

        return localizedJson({
          success: true,
          source: "ai_model",
          tasks: validatedTasks,
        });
      }

      throw new Error("Invalid tasks format from model response");
    } catch (modelError) {
      writeLog({ category: "ai", event: "ai.project.fallback", outcome: "failed", level: "warn", details: { errorName: modelError instanceof Error ? modelError.name : "UnknownError" } });
      const fallback = generateRuleBasedBreakdown(projectName, startDate, defaultAssignee, locale);
      return localizedJson({
        success: true,
        source: "smart_rules_fallback",
        tasks: fallback.tasks,
        matchedCategory: fallback.matchedCategory,
        matchedKeywords: fallback.matchedKeywords,
      });
    }
  } catch (error) {
    return localizedJson(
      { error: error instanceof Error ? error.message : "拆解项目失败" },
      { status: 500 },
    );
  }
}

export const POST = withRequestLogging("/api/ai/project-breakdown", POSTHandler);
