import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { safeFetch } from "@/lib/ssrf";
import { toLocalDateStr, addDaysLocal } from "@/lib/date-utils";

const REQUEST_TIMEOUT_MS = 25_000;

interface BreakdownTask {
  title: string;
  priority: "high" | "medium" | "low";
  dueDate: string;
  assigneeId?: string;
  assigneeName?: string;
}

// 智能规则回退拆解器（当未配置 AI Key 或网络异常时保障 100% 可用）
function generateRuleBasedBreakdown(
  projectName: string,
  baseDate: string,
  defaultAssignee?: { id: string; name: string },
): BreakdownTask[] {
  const p = projectName.toLowerCase();
  const aId = defaultAssignee?.id || "";
  const aName = defaultAssignee?.name || "";

  if (p.includes("部署") || p.includes("运维") || p.includes("集群") || p.includes("nas") || p.includes("docker") || p.includes("server")) {
    return [
      { title: `环境准备与 ${projectName} 依赖评估`, priority: "high", dueDate: addDaysLocal(baseDate, 1), assigneeId: aId, assigneeName: aName },
      { title: `核心服务容器化编排与配置文件编写`, priority: "high", dueDate: addDaysLocal(baseDate, 3), assigneeId: aId, assigneeName: aName },
      { title: `网络端口、反向代理与 SSL 证书配置`, priority: "medium", dueDate: addDaysLocal(baseDate, 6), assigneeId: aId, assigneeName: aName },
      { title: `数据持久化卷与自动备份策略验证`, priority: "medium", dueDate: addDaysLocal(baseDate, 9), assigneeId: aId, assigneeName: aName },
      { title: `全链路健康探针与监控告警接入`, priority: "low", dueDate: addDaysLocal(baseDate, 14), assigneeId: aId, assigneeName: aName },
    ];
  }

  if (p.includes("重构") || p.includes("优化") || p.includes("升级") || p.includes("整改")) {
    return [
      { title: `梳理现有架构痛点与制定 ${projectName} 目标`, priority: "high", dueDate: addDaysLocal(baseDate, 2), assigneeId: aId, assigneeName: aName },
      { title: `核心模块代码重构与解耦设计`, priority: "high", dueDate: addDaysLocal(baseDate, 6), assigneeId: aId, assigneeName: aName },
      { title: `UI/UX 交互升级与高频操作体验优化`, priority: "medium", dueDate: addDaysLocal(baseDate, 10), assigneeId: aId, assigneeName: aName },
      { title: `编写自动化单元测试并修复边缘回归`, priority: "medium", dueDate: addDaysLocal(baseDate, 13), assigneeId: aId, assigneeName: aName },
      { title: `发布新版本并归档阶段总结`, priority: "low", dueDate: addDaysLocal(baseDate, 15), assigneeId: aId, assigneeName: aName },
    ];
  }

  if (p.includes("设计") || p.includes("视觉") || p.includes("官网") || p.includes("前端") || p.includes("ui")) {
    return [
      { title: `竞品分析与 ${projectName} 设计系统/配色定义`, priority: "high", dueDate: addDaysLocal(baseDate, 2), assigneeId: aId, assigneeName: aName },
      { title: `核心页面高保真原型与响应式排版制作`, priority: "high", dueDate: addDaysLocal(baseDate, 5), assigneeId: aId, assigneeName: aName },
      { title: `前端组件库开发与交互微动画实现`, priority: "medium", dueDate: addDaysLocal(baseDate, 9), assigneeId: aId, assigneeName: aName },
      { title: `跨浏览器与移动端适配测试`, priority: "medium", dueDate: addDaysLocal(baseDate, 12), assigneeId: aId, assigneeName: aName },
      { title: `上线部署与 SEO 关键元数据配置`, priority: "low", dueDate: addDaysLocal(baseDate, 15), assigneeId: aId, assigneeName: aName },
    ];
  }

  // 通用敏捷工程拆解
  return [
    { title: `明确 ${projectName} 核心需求与可行性验证`, priority: "high", dueDate: addDaysLocal(baseDate, 2), assigneeId: aId, assigneeName: aName },
    { title: `完成核心功能原型设计与技术选型`, priority: "high", dueDate: addDaysLocal(baseDate, 5), assigneeId: aId, assigneeName: aName },
    { title: `核心功能编码实现与接口联调`, priority: "high", dueDate: addDaysLocal(baseDate, 9), assigneeId: aId, assigneeName: aName },
    { title: `联调测试、细节打磨与体验验收`, priority: "medium", dueDate: addDaysLocal(baseDate, 13), assigneeId: aId, assigneeName: aName },
    { title: `项目正式交付与后续维护规划`, priority: "low", dueDate: addDaysLocal(baseDate, 16), assigneeId: aId, assigneeName: aName },
  ];
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    const projectName = typeof body?.projectName === "string" ? body.projectName.trim() : "";
    const projectDescription = typeof body?.projectDescription === "string" ? body.projectDescription.trim() : "";
    const startDate = typeof body?.startDate === "string" && body.startDate.trim()
      ? body.startDate.trim()
      : toLocalDateStr();

    if (!projectName) {
      return NextResponse.json({ error: "项目名称不能为空" }, { status: 400 });
    }

    // 查询系统中所有注册成员列表
    const members = db
      .prepare("SELECT id, username, display_name AS displayName FROM users ORDER BY created_at ASC")
      .all() as Array<{ id: string; username: string; displayName: string }>;

    const currentUserName = user.displayName || user.username;
    const defaultAssignee = { id: user.id, name: currentUserName };

    // 1. 读取当前用户的 AI 配置
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

    // 若未配置 API Key，直接使用智能工程规则拆解
    if (!apiKey) {
      const fallbackTasks = generateRuleBasedBreakdown(projectName, startDate, defaultAssignee);
      return NextResponse.json({
        success: true,
        source: "smart_rules",
        tasks: fallbackTasks,
        message: "已使用内置敏捷拆分引擎为您智能规划日程。在后台配置 AI Key 可开启大模型专属拆解！",
      });
    }

    // 2. 调用大模型进行深度任务拆解与排期
    const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
    const targetUrl = cleanBaseUrl.endsWith("/chat/completions")
      ? cleanBaseUrl
      : `${cleanBaseUrl}/chat/completions`;

    const membersDesc = members.map((m) => `${m.displayName || m.username} (ID: ${m.id})`).join("、");

    const systemPrompt = `你是一位顶级的敏捷项目管理专家和系统架构师。
任务：请将用户提出的数字化项目拆分为 3 到 5 个递进、具体的行动里程碑任务，并为任务指派合适的团队成员。
当前排期基准日期是：${startDate}。
当前协同团队可选成员列表：${membersDesc || `${currentUserName} (ID: ${user.id})`}。

每个任务必须包含：
1. title: 任务名称（具体、明确、可执行，不超过20字）
2. priority: 优先级，必须从 "high"、"medium"、"low" 中选择
3. dueDate: 截止日期，必须为 YYYY-MM-DD 格式。请根据任务实际工作量和阶段难度合理预估工期（如前期准备 1~2 天，核心攻坚开发 3~6 天，系统联调测试 2~4 天，上线发布 1~2 天），不要机械地固定按每2天递增，要符合真实的工程交付节奏。
4. assigneeId: 推荐指派的成员 ID（必须从可选成员列表中的 ID 选择，若不确定则使用 "${user.id}"）
5. assigneeName: 推荐指派的成员名称（如 "${currentUserName}"）

输出格式约束：
你必须【只】返回一个合法的 JSON 对象，不要包含 markdown 格式标记、不要输出 \`\`\`json 等代码块，直接返回纯 JSON：
{"tasks":[{"title":"任务1","priority":"high","dueDate":"${startDate}","assigneeId":"${user.id}","assigneeName":"${currentUserName}"}]}`;

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
            { role: "system", content: systemPrompt },
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
        const validatedTasks: BreakdownTask[] = parsed.tasks.map((t: { title?: string; priority?: string; dueDate?: string; assigneeId?: string; assigneeName?: string }, idx: number) => ({
          title: String(t.title || `阶段任务 ${idx + 1}`).trim(),
          priority: t.priority === "high" || t.priority === "low" ? t.priority : "medium",
          dueDate: t.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) ? t.dueDate : addDaysLocal(startDate, (idx + 1) * 3),
          assigneeId: t.assigneeId ? String(t.assigneeId).trim() : defaultAssignee.id,
          assigneeName: t.assigneeName ? String(t.assigneeName).trim() : defaultAssignee.name,
        }));

        return NextResponse.json({
          success: true,
          source: "ai_model",
          tasks: validatedTasks,
        });
      }

      throw new Error("Invalid tasks format from model response");
    } catch (modelError) {
      console.warn("[AI Project Breakdown] Model call failed, fallback to rule generator:", modelError);
      const fallbackTasks = generateRuleBasedBreakdown(projectName, startDate, defaultAssignee);
      return NextResponse.json({
        success: true,
        source: "smart_rules_fallback",
        tasks: fallbackTasks,
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "拆解项目失败" },
      { status: 500 },
    );
  }
}
