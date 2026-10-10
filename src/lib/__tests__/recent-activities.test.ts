import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildSourceTabs,
  countActivityBySource,
  filterActivityItems,
  formatExactTime,
  isActivityFilterActive,
  linkUsageToActivities,
  mergeActivityItems,
  notificationToActivity,
  paginateActivityItems,
  parseLinkUsage,
  pickNotificationIcon,
  removeLinkUsageEntry,
  resolveActivitySource,
  type ActivityItem,
  type ActivitySource,
  type LinkUsageMap,
} from "../recent-activities.ts";
import type { SiteLink } from "@/types";

/**
 * 「消息通知与活动动态」卡片纯逻辑单测。
 *
 * 这些函数原先内联在 `recent-activities-card.tsx`（1002 行的巨石组件）里，
 * 无法被测试覆盖；抽出到 lib 后在此固定住来源识别、筛选与分页行为，
 * 防止后续重构悄悄改变筛选语义或徽标文案。
 */

const DAY = 24 * 60 * 60 * 1000;

function makeItem(over: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: "n-1",
    rawId: "1",
    source: "system",
    sourceLabel: "系统设置",
    sourceBadgeClass: "badge",
    title: "标题",
    detail: "内容",
    icon: "⚙️",
    ts: 1_700_000_000_000,
    ...over,
  };
}

function makeLink(over: Partial<SiteLink> = {}): SiteLink {
  return {
    id: "l1",
    title: "示例站点",
    url: "https://example.com",
    description: "",
    icon: "🌐",
    category: "默认",
    ...over,
  };
}

describe("resolveActivitySource", () => {
  test("显式来源标识优先命中对应模块", () => {
    assert.equal(resolveActivitySource("api").source, "api");
    assert.equal(resolveActivitySource("external").source, "api");
    assert.equal(resolveActivitySource("webhook").source, "api");
    assert.equal(resolveActivitySource("calendar").source, "calendar");
    assert.equal(resolveActivitySource("todo").source, "calendar");
    assert.equal(resolveActivitySource("agenda").source, "calendar");
    assert.equal(resolveActivitySource("project").source, "project");
    assert.equal(resolveActivitySource("projects").source, "project");
    assert.equal(resolveActivitySource("link").source, "link");
    assert.equal(resolveActivitySource("bookmark").source, "link");
    assert.equal(resolveActivitySource("visit").source, "link");
  });

  test("来源标识大小写与空白被归一化", () => {
    assert.equal(resolveActivitySource("  API  ").source, "api");
    assert.equal(resolveActivitySource("Calendar").source, "calendar");
  });

  test("无来源标识时按标题与内容关键词推断", () => {
    assert.equal(resolveActivitySource(undefined, "Docker 部署完成").source, "api");
    assert.equal(resolveActivitySource(undefined, "GitHub Actions 构建").source, "api");
    assert.equal(resolveActivitySource(undefined, "外部推送失败").source, "api");
    assert.equal(resolveActivitySource(undefined, "🐳 容器重启").source, "api");
    assert.equal(resolveActivitySource(undefined, "今日待办已同步").source, "calendar");
    assert.equal(resolveActivitySource(undefined, "📅 会议提醒").source, "calendar");
    assert.equal(resolveActivitySource(undefined, "项目已归档").source, "project");
    assert.equal(resolveActivitySource(undefined, "🚀 里程碑达成").source, "project");
    assert.equal(resolveActivitySource(undefined, "🗂️ 阶段任务更新").source, "project");
  });

  test("关键词同时出现在内容里也能命中", () => {
    assert.equal(resolveActivitySource(undefined, "系统提示", "webhook 回调").source, "api");
    assert.equal(resolveActivitySource(undefined, "系统提示", "日历已同步").source, "calendar");
  });

  test("无任何线索时回退到系统设置，并带默认图标", () => {
    const meta = resolveActivitySource(undefined, "普通记录");
    assert.equal(meta.source, "system");
    assert.equal(meta.label, "系统设置");
    assert.equal(meta.defaultIcon, "⚙️");
  });

  test("各来源的展示文案与徽标 class 固定", () => {
    assert.equal(resolveActivitySource("api").label, "API推送");
    assert.equal(resolveActivitySource("calendar").label, "日历日程");
    assert.equal(resolveActivitySource("project").label, "项目管理");
    assert.equal(resolveActivitySource("link").label, "快捷访问");
    for (const source of ["api", "calendar", "project", "link"] as ActivitySource[]) {
      const meta = resolveActivitySource(source);
      assert.ok(meta.badgeClass.length > 0, `${source} badgeClass`);
      assert.ok(meta.defaultIcon.length > 0, `${source} defaultIcon`);
    }
  });

  test("来源判定有先后顺序：API 关键词先于项目关键词", () => {
    // 「docker」与「项目」同时出现时按 API 归类（与原实现的分支顺序一致）
    assert.equal(resolveActivitySource(undefined, "docker 项目更新").source, "api");
  });
});

describe("pickNotificationIcon", () => {
  test("按标题关键词选择图标", () => {
    assert.equal(pickNotificationIcon("Docker 容器已重启", "⚙️"), "🐳");
    assert.equal(pickNotificationIcon("🐳", "⚙️"), "🐳");
    assert.equal(pickNotificationIcon("服务器负载告警", "⚙️"), "🖥️");
    assert.equal(pickNotificationIcon("数据备份完成", "⚙️"), "💾");
    assert.equal(pickNotificationIcon("执行还原", "⚙️"), "💾");
    assert.equal(pickNotificationIcon("密钥已轮换", "⚙️"), "🔐");
    assert.equal(pickNotificationIcon("令牌过期", "⚙️"), "🔐");
    assert.equal(pickNotificationIcon("磁盘告警", "⚙️"), "⚠️");
    assert.equal(pickNotificationIcon("快捷访问已置顶", "⚙️"), "📌");
  });

  test("未命中关键词时回退到来源默认图标", () => {
    assert.equal(pickNotificationIcon("普通通知", "📅"), "📅");
  });

  test("图标优先级：Docker 先于服务器与备份", () => {
    assert.equal(pickNotificationIcon("Docker 服务器备份", "⚙️"), "🐳");
  });
});

describe("notificationToActivity", () => {
  test("映射出条目 id、原始 id、来源徽标与图标", () => {
    const item = notificationToActivity({
      id: "42",
      title: "Docker 部署完成",
      content: "镜像已更新",
      source: "api",
      createdAt: 123,
    });
    assert.equal(item.id, "n-42");
    assert.equal(item.rawId, "42");
    assert.equal(item.source, "api");
    assert.equal(item.sourceLabel, "API推送");
    assert.equal(item.title, "Docker 部署完成");
    assert.equal(item.detail, "镜像已更新");
    assert.equal(item.icon, "🐳");
    assert.equal(item.ts, 123);
    assert.equal(item.url, undefined);
  });

  test("缺少来源时回退为系统设置", () => {
    const item = notificationToActivity({
      id: "1",
      title: "普通通知",
      content: "",
      createdAt: 1,
    });
    assert.equal(item.source, "system");
    assert.equal(item.icon, "⚙️");
  });
});

describe("linkUsageToActivities", () => {
  test("仅保留仍然存在的链接，并带上访问文案与目标地址", () => {
    const usage: LinkUsageMap = {
      l1: { count: 3, lastUsed: 200 },
      missing: { count: 1, lastUsed: 300 },
    };
    const items = linkUsageToActivities(usage, [makeLink()]);
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "l-l1");
    assert.equal(items[0].rawId, "l1");
    assert.equal(items[0].source, "link");
    assert.equal(items[0].title, "访问 示例站点");
    assert.equal(items[0].detail, "https://example.com");
    assert.equal(items[0].url, "https://example.com");
    assert.equal(items[0].icon, "🌐");
    assert.equal(items[0].ts, 200);
  });

  test("链接没有自定义图标时用 🔗 兜底", () => {
    const items = linkUsageToActivities({ l1: { count: 1, lastUsed: 1 } }, [
      makeLink({ icon: "" }),
    ]);
    assert.equal(items[0].icon, "🔗");
  });

  test("空记录得到空数组", () => {
    assert.deepEqual(linkUsageToActivities({}, [makeLink()]), []);
  });
});

describe("mergeActivityItems", () => {
  test("按时间倒序合并，新记录在前", () => {
    const merged = mergeActivityItems(
      [makeItem({ id: "a", ts: 100 }), makeItem({ id: "b", ts: 300 })],
      [makeItem({ id: "c", ts: 200 })],
    );
    assert.deepEqual(
      merged.map((i) => i.id),
      ["b", "c", "a"],
    );
  });
});

describe("parseLinkUsage / removeLinkUsageEntry", () => {
  test("空值解析为空对象，合法 JSON 原样返回", () => {
    assert.deepEqual(parseLinkUsage(null), {});
    const raw = JSON.stringify({ l1: { count: 2, lastUsed: 9 } });
    assert.deepEqual(parseLinkUsage(raw), { l1: { count: 2, lastUsed: 9 } });
  });

  test("非法 JSON 抛出异常（由调用方兜住）", () => {
    assert.throws(() => parseLinkUsage("{not json"));
  });

  test("删除指定条目且不改动入参", () => {
    const usage: LinkUsageMap = { a: { count: 1, lastUsed: 1 }, b: { count: 2, lastUsed: 2 } };
    const next = removeLinkUsageEntry(usage, "a");
    assert.deepEqual(Object.keys(next), ["b"]);
    assert.deepEqual(Object.keys(usage), ["a", "b"]);
  });
});

describe("filterActivityItems", () => {
  const items = [
    makeItem({ id: "api", source: "api", sourceLabel: "API推送", title: "Docker 部署", ts: 1_000 }),
    makeItem({
      id: "cal",
      source: "calendar",
      sourceLabel: "日历日程",
      title: "周会提醒",
      detail: "会议室 A",
      ts: 2_000,
    }),
    makeItem({ id: "sys", source: "system", sourceLabel: "系统设置", title: "普通记录", ts: 3_000 }),
  ];
  const base = {
    searchQuery: "",
    filterSource: "all" as ActivitySource,
    timeRange: "all" as const,
    customStartDate: "",
    customEndDate: "",
    nowTimestamp: 0,
  };

  test("默认条件返回全部", () => {
    assert.equal(filterActivityItems(items, base).length, 3);
  });

  test("按来源筛选", () => {
    const got = filterActivityItems(items, { ...base, filterSource: "calendar" });
    assert.deepEqual(
      got.map((i) => i.id),
      ["cal"],
    );
  });

  test("关键字命中标题、内容或来源标签，且大小写不敏感", () => {
    assert.deepEqual(
      filterActivityItems(items, { ...base, searchQuery: "docker" }).map((i) => i.id),
      ["api"],
    );
    assert.deepEqual(
      filterActivityItems(items, { ...base, searchQuery: "会议室" }).map((i) => i.id),
      ["cal"],
    );
    assert.deepEqual(
      filterActivityItems(items, { ...base, searchQuery: "api推送" }).map((i) => i.id),
      ["api"],
    );
    assert.equal(filterActivityItems(items, { ...base, searchQuery: "不存在" }).length, 0);
  });

  test("纯空白关键字视为未填写", () => {
    assert.equal(filterActivityItems(items, { ...base, searchQuery: "   " }).length, 3);
  });

  test("today 只保留与基准时间同一天的记录", () => {
    const now = new Date(2026, 0, 15, 12, 0, 0).getTime();
    const today = makeItem({ id: "today", ts: new Date(2026, 0, 15, 1, 0, 0).getTime() });
    const yesterday = makeItem({ id: "yesterday", ts: new Date(2026, 0, 14, 23, 0, 0).getTime() });
    const got = filterActivityItems([today, yesterday], {
      ...base,
      timeRange: "today",
      nowTimestamp: now,
    });
    assert.deepEqual(
      got.map((i) => i.id),
      ["today"],
    );
  });

  test("近 3 天 / 7 天 / 30 天按毫秒差判断", () => {
    const now = 100 * DAY;
    const cases: { ts: number; pass3d: boolean; pass7d: boolean; pass30d: boolean }[] = [
      { ts: now - 2 * DAY, pass3d: true, pass7d: true, pass30d: true },
      { ts: now - 4 * DAY, pass3d: false, pass7d: true, pass30d: true },
      { ts: now - 10 * DAY, pass3d: false, pass7d: false, pass30d: true },
      { ts: now - 40 * DAY, pass3d: false, pass7d: false, pass30d: false },
    ];
    for (const c of cases) {
      const one = [makeItem({ ts: c.ts })];
      assert.equal(
        filterActivityItems(one, { ...base, timeRange: "3d", nowTimestamp: now }).length === 1,
        c.pass3d,
        `ts=${c.ts} 近3天`,
      );
      assert.equal(
        filterActivityItems(one, { ...base, timeRange: "7d", nowTimestamp: now }).length === 1,
        c.pass7d,
        `ts=${c.ts} 近7天`,
      );
      assert.equal(
        filterActivityItems(one, { ...base, timeRange: "30d", nowTimestamp: now }).length === 1,
        c.pass30d,
        `ts=${c.ts} 近30天`,
      );
    }
  });

  test("自定义区间按本地日起止闭合，只填一端时另一端不设限", () => {
    const at = (y: number, m: number, d: number, h = 12) =>
      new Date(y, m - 1, d, h, 0, 0).getTime();
    const before = makeItem({ id: "before", ts: at(2025, 12, 31, 23) });
    const inside = makeItem({ id: "inside", ts: at(2026, 1, 15) });
    const after = makeItem({ id: "after", ts: at(2026, 2, 1, 0) });
    const all = [before, inside, after];

    const both = filterActivityItems(all, {
      ...base,
      timeRange: "custom",
      customStartDate: "2026-01-01",
      customEndDate: "2026-01-31",
    });
    assert.deepEqual(
      both.map((i) => i.id),
      ["inside"],
    );

    const fromOnly = filterActivityItems(all, {
      ...base,
      timeRange: "custom",
      customStartDate: "2026-01-01",
    });
    assert.deepEqual(
      fromOnly.map((i) => i.id),
      ["inside", "after"],
    );

    const toOnly = filterActivityItems(all, {
      ...base,
      timeRange: "custom",
      customEndDate: "2026-01-31",
    });
    assert.deepEqual(
      toOnly.map((i) => i.id),
      ["before", "inside"],
    );
  });

  test("结束日当天的 23:59:59 仍算区间内", () => {
    const endOfDay = makeItem({ id: "eod", ts: new Date(2026, 0, 31, 23, 59, 59).getTime() });
    const got = filterActivityItems([endOfDay], {
      ...base,
      timeRange: "custom",
      customStartDate: "2026-01-01",
      customEndDate: "2026-01-31",
    });
    assert.equal(got.length, 1);
  });

  test("多条件同时生效（来源 + 关键字 + 时间）", () => {
    const now = 100 * DAY;
    const got = filterActivityItems(
      [
        makeItem({ id: "hit", source: "api", title: "Docker 部署", ts: now - DAY }),
        makeItem({ id: "wrongSource", source: "system", title: "Docker 部署", ts: now - DAY }),
        makeItem({ id: "tooOld", source: "api", title: "Docker 部署", ts: now - 40 * DAY }),
        makeItem({ id: "noKeyword", source: "api", title: "普通记录", ts: now - DAY }),
      ],
      {
        ...base,
        filterSource: "api",
        searchQuery: "docker",
        timeRange: "7d",
        nowTimestamp: now,
      },
    );
    assert.deepEqual(
      got.map((i) => i.id),
      ["hit"],
    );
  });

  test("nowTimestamp 为 0 时时间筛选按 0 起算（与原实现一致）", () => {
    // 时间戳为正的记录都会因 now - ts 为负而通过 3d/7d/30d 判断
    const got = filterActivityItems([makeItem({ ts: 5_000 })], {
      ...base,
      timeRange: "3d",
      nowTimestamp: 0,
    });
    assert.equal(got.length, 1);
  });
});

describe("countActivityBySource / buildSourceTabs", () => {
  const items = [
    makeItem({ id: "1", source: "api" }),
    makeItem({ id: "2", source: "api" }),
    makeItem({ id: "3", source: "calendar" }),
    makeItem({ id: "4", source: "project" }),
    makeItem({ id: "5", source: "system" }),
    makeItem({ id: "6", source: "link" }),
  ];

  test("按来源计数并给出总数", () => {
    assert.deepEqual(countActivityBySource(items), {
      total: 6,
      api: 2,
      calendar: 1,
      project: 1,
      system: 1,
      link: 1,
    });
  });

  test("空列表计数全为 0", () => {
    assert.deepEqual(countActivityBySource([]), {
      total: 0,
      api: 0,
      calendar: 0,
      project: 0,
      system: 0,
      link: 0,
    });
  });

  test("标签列表固定为 6 项，顺序与文案不变", () => {
    const tabs = buildSourceTabs(countActivityBySource(items));
    assert.deepEqual(
      tabs.map((t) => [t.id, t.label, t.icon]),
      [
        ["all", "全部来源", "⚡"],
        ["api", "API推送", "🌐"],
        ["calendar", "日历日程", "📅"],
        ["project", "项目管理", "🗂️"],
        ["system", "系统设置", "⚙️"],
        ["link", "快捷访问", "🔗"],
      ],
    );
    assert.deepEqual(
      tabs.map((t) => t.count),
      [6, 2, 1, 1, 1, 1],
    );
  });
});

describe("paginateActivityItems", () => {
  const items = Array.from({ length: 25 }, (_, i) => makeItem({ id: String(i + 1) }));

  test("按页码截取并给出总页数", () => {
    const first = paginateActivityItems(items, 1, 10);
    assert.equal(first.totalPages, 3);
    assert.equal(first.pageItems.length, 10);
    assert.equal(first.pageItems[0].id, "1");

    const third = paginateActivityItems(items, 3, 10);
    assert.equal(third.pageItems.length, 5);
    assert.equal(third.pageItems[0].id, "21");
  });

  test("空结果时总页数仍为 1，避免出现「第 1 / 0 页」", () => {
    const empty = paginateActivityItems([], 1, 10);
    assert.equal(empty.totalPages, 1);
    assert.deepEqual(empty.pageItems, []);
  });

  test("页码越界时返回空页", () => {
    assert.deepEqual(paginateActivityItems(items, 9, 10).pageItems, []);
  });

  test("每页条数可变", () => {
    const page = paginateActivityItems(items, 2, 20);
    assert.equal(page.totalPages, 2);
    assert.equal(page.pageItems.length, 5);
  });
});

describe("isActivityFilterActive", () => {
  const none = {
    searchQuery: "",
    filterSource: "all" as ActivitySource,
    timeRange: "all" as const,
    customStartDate: "",
    customEndDate: "",
  };

  test("全部为默认值时不活跃", () => {
    assert.equal(isActivityFilterActive(none), false);
    assert.equal(isActivityFilterActive({ ...none, searchQuery: "   " }), false);
  });

  test("任一条件非默认即活跃", () => {
    assert.equal(isActivityFilterActive({ ...none, searchQuery: "a" }), true);
    assert.equal(isActivityFilterActive({ ...none, filterSource: "api" }), true);
    assert.equal(isActivityFilterActive({ ...none, timeRange: "7d" }), true);
    assert.equal(isActivityFilterActive({ ...none, customStartDate: "2026-01-01" }), true);
    assert.equal(isActivityFilterActive({ ...none, customEndDate: "2026-01-31" }), true);
  });
});

describe("formatExactTime", () => {
  test("输出 YYYY-MM-DD HH:mm:ss 且各段补零", () => {
    const d = new Date(2026, 0, 5, 9, 8, 7);
    assert.equal(formatExactTime(d.getTime()), "2026-01-05 09:08:07");
  });

  test("午夜与年末边界", () => {
    assert.equal(formatExactTime(new Date(2025, 11, 31, 0, 0, 0).getTime()), "2025-12-31 00:00:00");
  });
});
