import type { Project, SiteLink, TodoItem } from "@/types";
import { toLocalDateStr } from "./date-utils.ts";

/**
 * 数据看板的纯派生计算。
 *
 * 从 `dashboard-view.tsx`（原 674 行）抽出 —— 书签点击排行、待办闭环率、
 * 项目生命周期分布、服务健康度四组统计此前以 `useMemo` 内联在组件里，
 * 与 JSX 混在一起无法测试。
 */

export type LinkUsageMap = Record<string, { count: number; lastUsed: number }>;

/** 与 `useLinkStatus` 的 `LinkProbeInfo` 结构一致；此处本地声明以免 lib 依赖客户端 hook。 */
export interface ProbeInfoLike {
  status?: string;
}

export interface RankedLink {
  link: SiteLink;
  clicks: number;
  lastUsed: number;
}

export interface LinkAnalytics {
  totalClicks: number;
  /** 按点击数降序（含 0 次的书签） */
  rankedLinks: RankedLink[];
  quickAccessCount: number;
}

/**
 * 书签访问统计。
 *
 * `mounted` 为 false 时忽略 localStorage 读数：服务端渲染拿不到它，
 * 直接使用会导致首帧与客户端不一致（水合不匹配）。
 */
export function computeLinkAnalytics(
  links: SiteLink[],
  usageMap: LinkUsageMap,
  mounted: boolean,
): LinkAnalytics {
  const map = mounted ? usageMap : {};
  const totalClicks = Object.values(map).reduce((sum, u) => sum + u.count, 0);

  const rankedLinks = links
    .map((l) => ({
      link: l,
      clicks: map[l.id]?.count || 0,
      lastUsed: map[l.id]?.lastUsed || 0,
    }))
    .sort((a, b) => b.clicks - a.clicks);

  return {
    totalClicks,
    rankedLinks,
    quickAccessCount: links.filter((l) => l.isQuickAccess).length,
  };
}

export interface TodoMetrics {
  completed: number;
  pending: number;
  /** 完成率（%），无待办时按 0 计 */
  rate: number;
  /** 未完成待办中优先展示的至多 5 项 */
  urgentOrUpcoming: TodoItem[];
  todayStr: string;
}

/**
 * 待办闭环率与「临近到期」清单。
 *
 * 排序规则：高优先级置顶，同优先级按截止日期升序（无日期的排在最后）。
 * 原实现用 `localeCompare` 比较 YYYY-MM-DD 字符串，等价于日期先后，
 * 此处保留该写法。
 */
export function computeTodoMetrics(todos: TodoItem[], todayStr = toLocalDateStr()): TodoMetrics {
  const completed = todos.filter((t) => t.done).length;
  const pending = todos.filter((t) => !t.done).length;
  const total = todos.length || 1;
  const rate = Math.round((completed / total) * 100);

  const urgentOrUpcoming = todos
    .filter((t) => !t.done)
    .sort((a, b) => {
      if (a.priority === "high" && b.priority !== "high") return -1;
      if (b.priority === "high" && a.priority !== "high") return 1;
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      return 0;
    })
    .slice(0, 5);

  return { completed, pending, rate, urgentOrUpcoming, todayStr };
}

export interface ProjectMetrics {
  total: number;
  inProgress: number;
  completed: number;
  research: number;
  maintenance: number;
  /** 交付率（%），无项目时按 0 计 */
  deliveryRate: number;
}

/**
 * 项目生命周期分布。
 *
 * 状态是自由文本（用户可自定义），因此每类都用「包含」而非相等匹配；
 * 已完成额外接受精确的「已完成」。注意这几个判定存在重叠可能
 * （如「已完成开发」会同时命中 inProgress 与 completed），此处保留原行为。
 */
export function computeProjectMetrics(projects: Project[]): ProjectMetrics {
  const total = projects.length || 1;
  const inProgress = projects.filter(
    (p) =>
      (p.status || "").includes("进行") ||
      (p.status || "").includes("开发") ||
      (p.status || "").toLowerCase().includes("progress"),
  ).length;
  const completed = projects.filter(
    (p) => p.status === "已完成" || (p.status || "").includes("完成"),
  ).length;
  const research = projects.filter(
    (p) => p.status === "研究中" || (p.status || "").includes("研究"),
  ).length;
  const maintenance = projects.filter(
    (p) => p.status === "维护中" || (p.status || "").includes("维护"),
  ).length;

  return {
    total: projects.length,
    inProgress,
    completed,
    research,
    maintenance,
    deliveryRate: Math.round((completed / total) * 100),
  };
}

export interface ServiceHealth {
  /** 参与探测的链接数（仅 http(s)） */
  totalProbed: number;
  online: number;
  offline: number;
  /** 尚未探测出结果的数量 */
  pending: number;
  /** 在线率（%）：`slow` 计入在线，`pending` 不计入分母；探针未启用时固定 100 */
  uptimeRate: number;
  /** 大盘上展示的探针明细（最多 8 条） */
  probedList: SiteLink[];
}

/**
 * 基础设施健康度。
 *
 * 三处细节均为原实现行为，抽出时逐条保留：
 * 1. 只统计 `http(s)` 开头的链接 —— 其他协议无法探测，计入分母会永久拉低在线率；
 * 2. `slow` 计为在线（可达但慢），`pending` 既不算在线也不算离线，
 *    且**不进入分母**（否则首屏探测未完成时会显示 0%）；
 * 3. 探针功能未启用时在线率固定 100（此时没有数据可言，显示 0% 会误导）。
 */
export function computeServiceHealth(
  links: SiteLink[],
  statuses: Record<string, ProbeInfoLike>,
  linkStatusEnabled: boolean,
): ServiceHealth {
  const probedLinks = links.filter((l) => l.url.startsWith("http"));
  let online = 0;
  let offline = 0;
  let pending = 0;

  for (const l of probedLinks) {
    const s = statuses[l.id]?.status || "unknown";
    if (s === "online" || s === "slow") online++;
    else if (s === "offline") offline++;
    else pending++;
  }

  return {
    totalProbed: probedLinks.length,
    online,
    offline,
    pending,
    uptimeRate: linkStatusEnabled
      ? Math.round((online / (online + offline || 1)) * 100)
      : 100,
    probedList: probedLinks.slice(0, 8),
  };
}
