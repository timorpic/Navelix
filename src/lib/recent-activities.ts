import type { SiteLink } from "@/types";

/**
 * 「消息通知与活动动态」卡片的数据装配、来源识别与筛选分页（纯函数）。
 *
 * 从 `recent-activities-card.tsx`（原 1002 行）抽出 —— 该组件把数据读取、
 * 多条件联合筛选、批量删除与四块界面塞在一起；其中来源识别、条目装配、
 * 筛选/计数/分页与时间格式化都与 React 无关，放在这里才能被单测覆盖。
 * `use-recent-activities.ts` 只负责把结果接进 React 状态，组件只负责渲染。
 */

export type ActivitySource =
  | "all"
  | "api"
  | "calendar"
  | "project"
  | "system"
  | "link";

export type TimeRangePreset = "all" | "today" | "3d" | "7d" | "30d" | "custom";

export interface ActivityItem {
  id: string;
  rawId: string;
  source: ActivitySource;
  sourceLabel: string;
  sourceBadgeClass: string;
  title: string;
  detail?: string;
  url?: string;
  icon: string;
  ts: number;
}

/** 通知接口返回的单条记录（本卡片只用到这几个字段） */
export interface NotificationLike {
  id: string;
  title: string;
  content: string;
  source?: string;
  createdAt: number;
}

/** localStorage `navelix.link.usage` 的结构：链接 id -> 点击次数与最近点击时间 */
export type LinkUsageMap = Record<string, { count: number; lastUsed: number }>;

export interface ActivitySourceTab {
  id: ActivitySource;
  label: string;
  count: number;
  icon: string;
}

export interface ActivitySourceCounts {
  total: number;
  api: number;
  calendar: number;
  project: number;
  system: number;
  link: number;
}

/** 联合筛选的输入条件；`nowTimestamp` 由调用方注入，避免筛选依赖「当前时间」不可测。 */
export interface ActivityFilters {
  searchQuery: string;
  filterSource: ActivitySource;
  timeRange: TimeRangePreset;
  customStartDate: string;
  customEndDate: string;
  nowTimestamp: number;
}

/** 时间范围预设按钮 —— 文案与顺序即界面呈现，改动需同步视觉回归。 */
export const TIME_RANGE_PRESETS: { id: TimeRangePreset; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "today", label: "今天" },
  { id: "3d", label: "近3天" },
  { id: "7d", label: "近7天" },
  { id: "custom", label: "自定义" },
];

// 统一解析来源类型与徽标样式
export function resolveActivitySource(
  rawSource?: string,
  title: string = "",
  content: string = "",
): {
  source: ActivitySource;
  label: string;
  badgeClass: string;
  defaultIcon: string;
} {
  const s = (rawSource || "").toLowerCase().trim();
  const text = `${title} ${content}`.toLowerCase();

  if (
    s === "api" ||
    s === "external" ||
    s === "webhook" ||
    text.includes("docker") ||
    text.includes("github actions") ||
    text.includes("webhook") ||
    text.includes("ci/cd") ||
    text.includes("api 推送") ||
    text.includes("外部推送") ||
    title.includes("🐳")
  ) {
    return {
      source: "api",
      label: "API推送",
      badgeClass:
        "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800",
      defaultIcon: "🌐",
    };
  }

  if (
    s === "calendar" ||
    s === "todo" ||
    s === "agenda" ||
    text.includes("日程") ||
    text.includes("待办") ||
    text.includes("日历") ||
    title.includes("📅")
  ) {
    return {
      source: "calendar",
      label: "日历日程",
      badgeClass:
        "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800",
      defaultIcon: "📅",
    };
  }

  if (
    s === "project" ||
    s === "projects" ||
    text.includes("项目") ||
    text.includes("project") ||
    title.includes("🗂️") ||
    title.includes("🚀")
  ) {
    return {
      source: "project",
      label: "项目管理",
      badgeClass:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800",
      defaultIcon: "🗂️",
    };
  }

  if (
    s === "link" ||
    s === "bookmark" ||
    s === "visit"
  ) {
    return {
      source: "link",
      label: "快捷访问",
      badgeClass:
        "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800",
      defaultIcon: "🔗",
    };
  }

  // 默认：系统设置
  return {
    source: "system",
    label: "系统设置",
    badgeClass:
      "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200/50 dark:border-teal-800",
    defaultIcon: "⚙️",
  };
}

/** 通知标题里的关键词决定图标，未命中时回退到来源默认图标。 */
export function pickNotificationIcon(title: string, fallback: string): string {
  if (title.includes("Docker") || title.includes("🐳")) return "🐳";
  if (title.includes("服务器") || title.includes("🖥️")) return "🖥️";
  if (title.includes("备份") || title.includes("还原")) return "💾";
  if (title.includes("密钥") || title.includes("令牌")) return "🔐";
  if (title.includes("告警") || title.includes("负载")) return "⚠️";
  if (title.includes("快捷访问") || title.includes("置顶")) return "📌";
  return fallback;
}

/** 系统通知 -> 活动条目 */
export function notificationToActivity(n: NotificationLike): ActivityItem {
  const meta = resolveActivitySource(n.source, n.title, n.content);
  return {
    id: `n-${n.id}`,
    rawId: n.id,
    source: meta.source,
    sourceLabel: meta.label,
    sourceBadgeClass: meta.badgeClass,
    title: n.title,
    detail: n.content,
    icon: pickNotificationIcon(n.title, meta.defaultIcon),
    ts: n.createdAt,
  };
}

/** 链接访问记录 -> 活动条目（仅保留当前仍存在的链接） */
export function linkUsageToActivities(
  usage: LinkUsageMap,
  links: SiteLink[],
): ActivityItem[] {
  const activities: ActivityItem[] = [];
  for (const [id, u] of Object.entries(usage)) {
    const link = links.find((l) => l.id === id);
    if (link) {
      const meta = resolveActivitySource("link", link.title, link.url);
      activities.push({
        id: `l-${id}`,
        rawId: id,
        source: "link",
        sourceLabel: meta.label,
        sourceBadgeClass: meta.badgeClass,
        title: `访问 ${link.title}`,
        detail: link.url,
        url: link.url,
        icon: link.icon || "🔗",
        ts: u.lastUsed,
      });
    }
  }
  return activities;
}

/** 汇总合并通知与链接访问条目，按时间倒序（新在前）。 */
export function mergeActivityItems(
  notifications: ActivityItem[],
  linkActivities: ActivityItem[],
): ActivityItem[] {
  return [...notifications, ...linkActivities].sort((a, b) => b.ts - a.ts);
}

/** 解析 localStorage 中的链接使用记录；调用方负责兜住 JSON 解析异常。 */
export function parseLinkUsage(raw: string | null): LinkUsageMap {
  return raw ? JSON.parse(raw) : {};
}

/** 从使用记录中移除一条（返回新对象，不改动入参）。 */
export function removeLinkUsageEntry(usage: LinkUsageMap, id: string): LinkUsageMap {
  const next = { ...usage };
  delete next[id];
  return next;
}

/** 多条件组合联合筛选（来源 -> 关键字 -> 时间范围）。 */
export function filterActivityItems(
  items: ActivityItem[],
  filters: ActivityFilters,
): ActivityItem[] {
  const {
    searchQuery,
    filterSource,
    timeRange,
    customStartDate,
    customEndDate,
    nowTimestamp,
  } = filters;
  const now = nowTimestamp || 0;
  const oneDay = 24 * 60 * 60 * 1000;

  return items.filter((item) => {
    // 1. 来源筛选
    if (filterSource !== "all" && item.source !== filterSource) {
      return false;
    }

    // 2. 关键字搜索 (标题、内容、来源)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDetail = (item.detail || "").toLowerCase().includes(q);
      const matchSource = item.sourceLabel.toLowerCase().includes(q);
      if (!matchTitle && !matchDetail && !matchSource) return false;
    }

    // 3. 时间范围筛选
    if (timeRange === "today") {
      const itemDate = new Date(item.ts).toDateString();
      const todayDate = new Date(now).toDateString();
      if (itemDate !== todayDate) return false;
    } else if (timeRange === "3d") {
      if (now - item.ts > 3 * oneDay) return false;
    } else if (timeRange === "7d") {
      if (now - item.ts > 7 * oneDay) return false;
    } else if (timeRange === "30d") {
      if (now - item.ts > 30 * oneDay) return false;
    } else if (timeRange === "custom") {
      if (customStartDate) {
        const startTs = new Date(`${customStartDate}T00:00:00`).getTime();
        if (item.ts < startTs) return false;
      }
      if (customEndDate) {
        const endTs = new Date(`${customEndDate}T23:59:59`).getTime();
        if (item.ts > endTs) return false;
      }
    }

    return true;
  });
}

/** 各来源实时统计数量 */
export function countActivityBySource(items: ActivityItem[]): ActivitySourceCounts {
  return {
    total: items.length,
    api: items.filter((i) => i.source === "api").length,
    calendar: items.filter((i) => i.source === "calendar").length,
    project: items.filter((i) => i.source === "project").length,
    system: items.filter((i) => i.source === "system").length,
    link: items.filter((i) => i.source === "link").length,
  };
}

/** 来源标签列表（下拉框与快捷胶囊共用同一份数据）。 */
export function buildSourceTabs(counts: ActivitySourceCounts): ActivitySourceTab[] {
  return [
    { id: "all", label: "全部来源", count: counts.total, icon: "⚡" },
    { id: "api", label: "API推送", count: counts.api, icon: "🌐" },
    { id: "calendar", label: "日历日程", count: counts.calendar, icon: "📅" },
    { id: "project", label: "项目管理", count: counts.project, icon: "🗂️" },
    { id: "system", label: "系统设置", count: counts.system, icon: "⚙️" },
    { id: "link", label: "快捷访问", count: counts.link, icon: "🔗" },
  ];
}

/** 分页数据截取；总页数至少为 1（空结果也显示「第 1 / 1 页」）。 */
export function paginateActivityItems(
  items: ActivityItem[],
  currentPage: number,
  pageSize: number,
): { totalPages: number; pageItems: ActivityItem[] } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const start = (currentPage - 1) * pageSize;
  return { totalPages, pageItems: items.slice(start, start + pageSize) };
}

/** 是否存在任一筛选条件（用于「组合检索」高亮与重置条显示）。 */
export function isActivityFilterActive(
  filters: Pick<
    ActivityFilters,
    "searchQuery" | "filterSource" | "timeRange" | "customStartDate" | "customEndDate"
  >,
): boolean {
  return (
    Boolean(filters.searchQuery.trim()) ||
    filters.filterSource !== "all" ||
    filters.timeRange !== "all" ||
    Boolean(filters.customStartDate) ||
    Boolean(filters.customEndDate)
  );
}

/** 精确到秒的本地时间戳（YYYY-MM-DD HH:mm:ss）。 */
export function formatExactTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const date = pad(d.getDate());
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  const secs = pad(d.getSeconds());
  return `${year}-${month}-${date} ${hours}:${mins}:${secs}`;
}
