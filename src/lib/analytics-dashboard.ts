/**
 * 使用统计看板的纯数据层。
 *
 * 从 `admin-analytics-tab.tsx`（原 614 行）抽出 —— 事件中文名映射、模块清单、
 * 空汇总兜底与概览卡/趋势图的数值计算此前与组件状态混在一起，无法测试。
 */

export interface AnalyticsSummary {
  enabled: boolean;
  collectedSince: number | null; // 首次开始采集时间（ms）
  stats: {
    todayValueMoments: number; // 今日价值时刻数
    wau: number; // 本周活跃用户（7 天去重）
    activationRate: number | null; // 本月激活率（%），样本不足为 null
    totalEvents: number; // 事件总数
  };
  trend7d: Array<{ date: string; count: number }>; // 近 7 日价值时刻
  topEvents: Array<{ event: string; count: number; label: string; module: string }>; // 功能 Top 榜（降序）
  moduleBreakdown: Array<{ module: string; count: number; percent: number }>; // 8 大模块分布
  retention: Array<{
    cohortDate: string; // 注册日（YYYY-MM-DD）
    sampleSize: number;
    d1: number | null; // D1 留存 %，样本 < 3 为 null
    d7: number | null; // D7 留存 %，样本 < 3 为 null
  }>; // 最近 5 个注册日群组
}

/* ──────────────────────────────────────────────────────────────
 * 事件中文名映射（与 wiki §4 事件清单一一对应）
 * ────────────────────────────────────────────────────────────── */
export const EVENT_LABELS: Record<string, { label: string; module: string }> = {
  // 导航
  "nav.link_click": { label: "点击导航链接", module: "导航" },
  "nav.search": { label: "全局搜索", module: "导航" },
  "nav.bookmark_import": { label: "书签导入", module: "导航" },
  "nav.link_add": { label: "新增链接", module: "导航" },
  "nav.link_edit": { label: "编辑链接", module: "导航" },
  "nav.link_delete": { label: "删除链接", module: "导航" },
  // AI
  "ai.chat_sent": { label: "AI 对话", module: "AI" },
  "ai.project_breakdown": { label: "AI 项目拆解", module: "AI" },
  "ai.daily_schedule": { label: "AI 日程规划", module: "AI" },
  // 项目
  "project.create": { label: "创建项目", module: "项目" },
  "project.update": { label: "编辑项目", module: "项目" },
  "project.gantt_view": { label: "查看甘特图", module: "项目" },
  // 日历 / 待办
  "todo.create": { label: "创建待办", module: "日历" },
  "todo.complete": { label: "完成待办", module: "日历" },
  "todo.rollover": { label: "逾期顺延", module: "日历" },
  "calendar.view": { label: "查看日历", module: "日历" },
  // 备份
  "backup.create": { label: "手动备份", module: "备份" },
  "backup.restore": { label: "数据恢复", module: "备份" },
  // 账户
  "auth.register": { label: "用户注册", module: "账户" },
  "auth.login": { label: "用户登录", module: "账户" },
  "auth.logout": { label: "退出登录", module: "账户" },
  // 监控
  "monitor.quota_view": { label: "额度监控", module: "监控" },
  // 协作
  "team.member_add": { label: "添加成员", module: "协作" },
  "share.create": { label: "创建分享", module: "协作" },
};

/** 价值时刻事件集合（wiki §6.2）——由后端 summary 统计，此处保留清单便于对照 */
export const VALUE_MOMENT_EVENTS = new Set([
  "nav.link_click",
  "ai.chat_sent",
  "calendar.view",
  "project.gantt_view",
  "todo.complete",
  "nav.link_add",
  "nav.link_edit",
  "backup.create",
]);

export const VALUE_MOMENT_EVENT_COUNT = VALUE_MOMENT_EVENTS.size;

export const MODULES = ["导航", "AI", "项目", "日历", "备份", "账户", "监控", "协作"];

export const EMPTY_SUMMARY: AnalyticsSummary = {
  enabled: true, // 本地统计默认开启（数据仅存本机）；fetch 失败时按默认态展示
  collectedSince: null,
  stats: { todayValueMoments: 0, wau: 0, activationRate: null, totalEvents: 0 },
  trend7d: [],
  topEvents: [],
  moduleBreakdown: [],
  retention: [],
};

export interface OverviewCard {
  label: string;
  value: number | string;
  suffix: string;
  icon: string;
  color: string;
  hint: string;
}

/**
 * 组装顶部四张概览卡。
 *
 * `activationRate` 为 null 时展示破折号而非 `null%`（样本不足，后端刻意返回 null）；
 * 采集起始时间为空时提示「暂无采集」。
 */
export function buildOverviewCards(summary: AnalyticsSummary): OverviewCard[] {
  const { stats } = summary;
  return [
    {
      label: "今日价值时刻",
      value: stats.todayValueMoments,
      suffix: "次",
      icon: "⚡",
      color: "text-[#00C776] bg-teal-50 dark:bg-teal-950/60",
      hint: "点击/对话/勾选等关键动作",
    },
    {
      label: "本周活跃用户",
      value: stats.wau,
      suffix: "人",
      icon: "👥",
      color: "text-sky-500 bg-sky-50 dark:bg-sky-950/60",
      hint: "近 7 天产生价值时刻的去重用户",
    },
    {
      label: "本月激活率",
      value: stats.activationRate === null ? "—" : `${stats.activationRate}%`,
      suffix: "",
      icon: "🎯",
      color: "text-purple-500 bg-purple-50 dark:bg-purple-950/60",
      hint: stats.activationRate === null ? "样本不足，暂不计算" : "首次登录 7 天内达成激活",
    },
    {
      label: "累计事件",
      value: stats.totalEvents,
      suffix: "条",
      icon: "📈",
      color: "text-amber-500 bg-amber-50 dark:bg-amber-950/60",
      hint: summary.collectedSince
        ? `自 ${new Date(summary.collectedSince).toLocaleDateString()} 起`
        : "暂无采集",
    },
  ];
}

/**
 * 趋势柱状图的纵向缩放基准。
 *
 * 下界固定为 1：全为 0 时若用 0 作除数会得到 NaN 柱高。
 */
export function trendScale(trend7d: Array<{ date: string; count: number }>): {
  max: number;
  data: Array<{ date: string; count: number }>;
} {
  return { max: Math.max(1, ...trend7d.map((d) => d.count)), data: trend7d };
}
