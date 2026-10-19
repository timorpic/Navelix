import { addDaysLocal } from "./date-utils.ts";

/**
 * 规则拆解器（无 AI Key 或模型调用失败时的兜底）。
 *
 * 从 `api/ai/project-breakdown/route.ts` 下沉：原实现在路由里用一串
 * `p.includes("ui")` 做首命中判断，有两个真实缺陷：
 *
 * 1. **ASCII 子串误命中**：`ui` 会命中 `build` / `guide` / `quick`，
 *    `nas` 会命中 `canvas` / `analysis` —— 任意含这些字母的英文项目名
 *    都会落进错误模板。ASCII 关键词改为词边界匹配。
 * 2. **顺序 if-else 首命中**：同时命中「部署」与「重构」时永远选部署，
 *    且无法解释为什么。改为按权重打分取最高分，并回传命中关键词。
 */

export const BREAKDOWN_CATEGORIES = ["deploy", "refactor", "design", "generic"] as const;
export type BreakdownCategory = (typeof BREAKDOWN_CATEGORIES)[number];

interface BreakdownKeyword {
  term: string;
  weight: number;
}

/**
 * 关键词表。
 *
 * - 中文按子串匹配（中文没有天然词边界）；
 * - ASCII 词按 `\b` 词边界匹配，避免 `ui` 命中 `build`；
 * - 权重用于同分排序：更具体的领域词（docker、container、tls）高于泛词（server）。
 */
const CATEGORY_KEYWORDS: Record<Exclude<BreakdownCategory, "generic">, BreakdownKeyword[]> = {
  deploy: [
    { term: "部署", weight: 3 },
    { term: "运维", weight: 3 },
    { term: "集群", weight: 3 },
    { term: "docker", weight: 3 },
    { term: "kubernetes", weight: 3 },
    { term: "k8s", weight: 3 },
    { term: "deploy", weight: 2 },
    { term: "deployment", weight: 2 },
    { term: "operations", weight: 2 },
    { term: "cluster", weight: 2 },
    { term: "server", weight: 2 },
    { term: "nas", weight: 2 },
  ],
  refactor: [
    { term: "重构", weight: 3 },
    { term: "优化", weight: 3 },
    { term: "升级", weight: 3 },
    { term: "整改", weight: 3 },
    { term: "refactor", weight: 2 },
    { term: "optimize", weight: 2 },
    { term: "upgrade", weight: 2 },
    { term: "improve", weight: 2 },
  ],
  design: [
    { term: "设计", weight: 3 },
    { term: "视觉", weight: 3 },
    { term: "官网", weight: 3 },
    { term: "前端", weight: 3 },
    { term: "design", weight: 2 },
    { term: "visual", weight: 2 },
    { term: "website", weight: 2 },
    { term: "frontend", weight: 2 },
    { term: "ui", weight: 2 },
  ],
};

export interface BreakdownMatch {
  category: BreakdownCategory;
  /** 命中的关键词（按命中顺序），用于日志与调参 */
  matchedKeywords: string[];
  score: number;
}

/** ASCII 词用词边界，中文用子串；大小写不敏感。 */
function matchesTerm(haystack: string, term: string): boolean {
  if (/^[a-z0-9-]+$/.test(term)) {
    return new RegExp(`\\b${term}\\b`, "i").test(haystack);
  }
  return haystack.includes(term);
}

/**
 * 对项目名打分，返回分数最高的分类。
 *
 * 全不命中 → `generic`；并列时按 `deploy → refactor → design` 的声明顺序取前者
 * （部署类模板的工序最具体，误用代价最低）。
 */
export function matchBreakdownCategory(projectName: string): BreakdownMatch {
  const haystack = projectName.toLowerCase();
  let best: BreakdownMatch = { category: "generic", matchedKeywords: [], score: 0 };

  for (const category of ["deploy", "refactor", "design"] as const) {
    let score = 0;
    const matchedKeywords: string[] = [];
    for (const { term, weight } of CATEGORY_KEYWORDS[category]) {
      if (matchesTerm(haystack, term)) {
        score += weight;
        matchedKeywords.push(term);
      }
    }
    if (score > best.score) best = { category, matchedKeywords, score };
  }

  return best;
}

export interface BreakdownTask {
  title: string;
  priority: "high" | "medium" | "low";
  dueDate: string;
  assigneeId?: string;
  assigneeName?: string;
}

export interface RuleBreakdownResult {
  tasks: BreakdownTask[];
  matchedCategory: BreakdownCategory;
  matchedKeywords: string[];
}

/**
 * 生成规则拆解任务。
 *
 * 任务模板保持与原实现逐条一致（文案、优先级、相对日期），只替换「选哪个模板」
 * 的判定逻辑。`locale === "en"` 时输出英文标题。
 */
export function generateRuleBasedBreakdown(
  projectName: string,
  baseDate: string,
  defaultAssignee?: { id: string; name: string },
  locale = "zh-CN",
): RuleBreakdownResult {
  const match = matchBreakdownCategory(projectName);
  const aId = defaultAssignee?.id || "";
  const aName = defaultAssignee?.name || "";
  const en = locale === "en";

  const task = (
    title: string,
    priority: BreakdownTask["priority"],
    offset: number,
  ): BreakdownTask => ({
    title,
    priority,
    dueDate: addDaysLocal(baseDate, offset),
    assigneeId: aId,
    assigneeName: aName,
  });

  if (match.category === "deploy") {
    return {
      matchedCategory: match.category,
      matchedKeywords: match.matchedKeywords,
      tasks: [
        task(en ? `Prepare environment and assess dependencies for ${projectName}` : `环境准备与 ${projectName} 依赖评估`, "high", 1),
        task(en ? "Containerize core services and write configuration" : "核心服务容器化编排与配置文件编写", "high", 3),
        task(en ? "Configure network ports, reverse proxy and TLS" : "网络端口、反向代理与 SSL 证书配置", "medium", 6),
        task(en ? "Verify persistent volumes and automated backups" : "数据持久化卷与自动备份策略验证", "medium", 9),
        task(en ? "Set up health probes, monitoring and alerts" : "全链路健康探针与监控告警接入", "low", 14),
      ],
    };
  }

  if (match.category === "refactor") {
    return {
      matchedCategory: match.category,
      matchedKeywords: match.matchedKeywords,
      tasks: [
        task(en ? `Review architecture and define goals for ${projectName}` : `梳理现有架构痛点与制定 ${projectName} 目标`, "high", 2),
        task(en ? "Refactor and decouple core modules" : "核心模块代码重构与解耦设计", "high", 6),
        task(en ? "Improve UI/UX and common workflows" : "UI/UX 交互升级与高频操作体验优化", "medium", 10),
        task(en ? "Add unit tests and fix edge-case regressions" : "编写自动化单元测试并修复边缘回归", "medium", 13),
        task(en ? "Release the update and document outcomes" : "发布新版本并归档阶段总结", "low", 15),
      ],
    };
  }

  if (match.category === "design") {
    return {
      matchedCategory: match.category,
      matchedKeywords: match.matchedKeywords,
      tasks: [
        task(en ? `Research alternatives and define the design system for ${projectName}` : `竞品分析与 ${projectName} 设计系统/配色定义`, "high", 2),
        task(en ? "Create high-fidelity prototypes and responsive layouts" : "核心页面高保真原型与响应式排版制作", "high", 5),
        task(en ? "Build UI components and interaction animations" : "前端组件库开发与交互微动画实现", "medium", 9),
        task(en ? "Test across browsers and mobile devices" : "跨浏览器与移动端适配测试", "medium", 12),
        task(en ? "Deploy and configure SEO metadata" : "上线部署与 SEO 关键元数据配置", "low", 15),
      ],
    };
  }

  return {
    matchedCategory: "generic",
    matchedKeywords: [],
    tasks: [
      task(en ? `Define requirements and validate feasibility for ${projectName}` : `明确 ${projectName} 核心需求与可行性验证`, "high", 2),
      task(en ? "Prototype core features and choose the technology" : "完成核心功能原型设计与技术选型", "high", 5),
      task(en ? "Implement core features and integrate APIs" : "核心功能编码实现与接口联调", "high", 9),
      task(en ? "Run integration tests and validate the experience" : "联调测试、细节打磨与体验验收", "medium", 13),
      task(en ? "Deliver the project and plan maintenance" : "项目正式交付与后续维护规划", "low", 16),
    ],
  };
}
