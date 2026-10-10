import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LINK_USAGE_STORAGE_KEY,
  buildCategoryDeleteMessage,
  buildClearLinksMessage,
  buildLinkDeleteMessage,
  buildShareUrl,
  categoryName,
  computeLinkUsageStats,
  countLinksInCategory,
  filterLinks,
  paginateLinks,
  parseLinkUsage,
  totalLinkPages,
} from "../admin-links.ts";
import type { Category, SiteLink } from "@/types";

/**
 * 「链接管理」Tab 纯逻辑单测。
 *
 * 这些函数原先内联在 `admin-links-tab.tsx`（764 行）里：分组名回退、关键词
 * 过滤、分页切片、本机点击统计聚合与确认弹窗文案都无法被测试覆盖。
 * 抽出到 lib 后在此固定住行为，防止后续重构悄悄改变过滤范围、统计口径
 * 或界面文案。
 */

function makeLink(over: Partial<SiteLink> & { id: string }): SiteLink {
  return {
    title: "标题",
    url: "https://example.com",
    description: "",
    icon: "",
    category: "cat-1",
    ...over,
  };
}

function makeCategory(id: string, name: string): Category {
  return { id, name, label: name, icon: "📁", color: "#000" };
}

describe("admin-links: categoryName", () => {
  const categories = [makeCategory("cat-1", "常用工具"), makeCategory("cat-2", "AI")];

  it("按 id 取出分组名", () => {
    assert.equal(categoryName(categories, "cat-2"), "AI");
  });

  it("查不到时回退为 AI Tools（沿用原内联实现的历史回退值）", () => {
    assert.equal(categoryName(categories, "missing"), "AI Tools");
    assert.equal(categoryName([], "cat-1"), "AI Tools");
  });
});

describe("admin-links: filterLinks", () => {
  const links = [
    makeLink({ id: "1", title: "GitHub", url: "https://github.com", category: "dev" }),
    makeLink({
      id: "2",
      title: "DeepSeek",
      url: "https://chat.deepseek.com",
      description: "国产大模型对话",
      category: "ai",
    }),
    makeLink({
      id: "3",
      title: "Figma",
      url: "https://figma.com",
      category: "ai",
      notes: "设计协作平台",
    }),
  ];

  it("category 为 all 且关键词为空时原样返回入参", () => {
    const result = filterLinks(links, { category: "all", query: "" });
    assert.equal(result, links);
  });

  it("只输入空白字符时不触发关键词过滤", () => {
    assert.equal(filterLinks(links, { category: "all", query: "   " }), links);
  });

  it("按分组过滤", () => {
    const result = filterLinks(links, { category: "ai", query: "" });
    assert.deepEqual(
      result.map((l) => l.id),
      ["2", "3"],
    );
  });

  it("关键词匹配标题、网址、描述与笔记，且忽略大小写", () => {
    assert.deepEqual(
      filterLinks(links, { category: "all", query: "github" }).map((l) => l.id),
      ["1"],
    );
    assert.deepEqual(
      filterLinks(links, { category: "all", query: "DEEPSEEK" }).map((l) => l.id),
      ["2"],
    );
    assert.deepEqual(
      filterLinks(links, { category: "all", query: "大模型" }).map((l) => l.id),
      ["2"],
    );
    assert.deepEqual(
      filterLinks(links, { category: "all", query: "设计协作" }).map((l) => l.id),
      ["3"],
    );
  });

  it("notes 缺失的链接不会因笔记匹配而报错", () => {
    assert.deepEqual(
      filterLinks(links, { category: "all", query: "不存在的词" }),
      [],
    );
  });

  it("分组与关键词同时生效（交集）", () => {
    assert.deepEqual(
      filterLinks(links, { category: "ai", query: "figma" }).map((l) => l.id),
      ["3"],
    );
    assert.deepEqual(filterLinks(links, { category: "dev", query: "figma" }), []);
  });
});

describe("admin-links: paginateLinks", () => {
  const links = Array.from({ length: 25 }, (_, i) => makeLink({ id: String(i + 1) }));

  it("按页切片，页码从 1 开始", () => {
    assert.deepEqual(
      paginateLinks(links, 1, 10).map((l) => l.id),
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    );
    assert.deepEqual(
      paginateLinks(links, 3, 10).map((l) => l.id),
      ["21", "22", "23", "24", "25"],
    );
  });

  it("页码越界时返回空数组（不做钳制，与 slice 一致）", () => {
    assert.deepEqual(paginateLinks(links, 4, 10), []);
    assert.deepEqual(paginateLinks(links, 0, 10), []);
  });
});

describe("admin-links: totalLinkPages", () => {
  it("空列表也算 1 页", () => {
    assert.equal(totalLinkPages(0, 10), 1);
  });

  it("整除时不多出一页，有余数时向上取整", () => {
    assert.equal(totalLinkPages(20, 10), 2);
    assert.equal(totalLinkPages(21, 10), 3);
  });
});

describe("admin-links: countLinksInCategory", () => {
  it("统计指定分组下的链接数", () => {
    const links = [
      makeLink({ id: "1", category: "ai" }),
      makeLink({ id: "2", category: "dev" }),
      makeLink({ id: "3", category: "ai" }),
    ];
    assert.equal(countLinksInCategory(links, "ai"), 2);
    assert.equal(countLinksInCategory(links, "missing"), 0);
  });
});

describe("admin-links: parseLinkUsage", () => {
  it("正常对象原样返回", () => {
    const map = { "1": { count: 3, lastUsed: 1700000000000 } };
    assert.deepEqual(parseLinkUsage(JSON.stringify(map)), map);
  });

  it("空值、损坏 JSON 与非对象一律回退为空表", () => {
    assert.deepEqual(parseLinkUsage(null), {});
    assert.deepEqual(parseLinkUsage(""), {});
    assert.deepEqual(parseLinkUsage("{ 坏掉的 json"), {});
    assert.deepEqual(parseLinkUsage("null"), {});
    assert.deepEqual(parseLinkUsage("[1,2]"), {});
    assert.deepEqual(parseLinkUsage("\"str\""), {});
  });

  it("键名与 link-usage 模块共用同一份数据", () => {
    assert.equal(LINK_USAGE_STORAGE_KEY, "navelix.link.usage");
  });
});

describe("admin-links: computeLinkUsageStats", () => {
  const links = [
    makeLink({ id: "1", title: "GitHub", category: "dev" }),
    makeLink({ id: "2", title: "DeepSeek", category: "ai" }),
    makeLink({ id: "3", title: "Figma", category: "ai" }),
  ];
  // 固定「当前时间」，避免用例随运行时刻漂移（本地时区当天 0 点为分界）
  const now = new Date("2026-10-10T15:00:00");
  const todayAt = (h: number) => new Date("2026-10-10T00:00:00").setHours(h);

  it("今日点击量只累加当天 0 点及之后的条目", () => {
    const stats = computeLinkUsageStats(links, {
      "1": { count: 2, lastUsed: todayAt(9) },
      "2": { count: 5, lastUsed: todayAt(0) },
      // 昨天 23 点：不计入
      "3": { count: 100, lastUsed: todayAt(0) - 3600000 },
    }, now);
    assert.equal(stats.todayClicks, 7);
  });

  it("无任何记录时三项均为空", () => {
    const stats = computeLinkUsageStats(links, {}, now);
    assert.equal(stats.todayClicks, 0);
    assert.equal(stats.topCategoryId, null);
    assert.equal(stats.topLink, null);
  });

  it("最热分组按分组内已记录条目的点击总数排序", () => {
    const stats = computeLinkUsageStats(links, {
      "1": { count: 1, lastUsed: todayAt(9) },
      "2": { count: 4, lastUsed: todayAt(9) },
      "3": { count: 3, lastUsed: todayAt(9) },
    }, now);
    assert.equal(stats.topCategoryId, "ai");
  });

  it("没有记录的分组不参与最热分组评选", () => {
    const stats = computeLinkUsageStats(links, {
      "1": { count: 9, lastUsed: todayAt(9) },
    }, now);
    assert.equal(stats.topCategoryId, "dev");
  });

  it("最热链接按点击量降序取首位；全为 0 时视为无数据", () => {
    const stats = computeLinkUsageStats(links, {
      "1": { count: 1, lastUsed: todayAt(9) },
      "2": { count: 7, lastUsed: todayAt(9) },
    }, now);
    assert.equal(stats.topLink?.id, "2");

    const zero = computeLinkUsageStats(links, {
      "1": { count: 0, lastUsed: todayAt(9) },
    }, now);
    assert.equal(zero.topLink, null);
  });
});

describe("admin-links: buildShareUrl", () => {
  it("拼出 origin + sharePath 的绝对地址", () => {
    assert.equal(
      buildShareUrl("https://nav.example.com", "/share/category/ai?token=abc.def"),
      "https://nav.example.com/share/category/ai?token=abc.def",
    );
  });
});

describe("admin-links: 确认弹窗文案", () => {
  it("删除链接的文案", () => {
    assert.equal(buildLinkDeleteMessage("GitHub"), "确定要删除链接 \"GitHub\" 吗？");
  });

  it("删除分组：有链接时追加影响面说明", () => {
    assert.equal(
      buildCategoryDeleteMessage("AI", 3),
      "确定要删除分组 \"AI\" 吗？该分组下的 3 个链接也将一并被移除。",
    );
  });

  it("删除分组：无链接时不追加说明", () => {
    assert.equal(buildCategoryDeleteMessage("AI", 0), "确定要删除分组 \"AI\" 吗？");
  });

  it("清空全部链接的提示带清空前的数量", () => {
    assert.equal(buildClearLinksMessage(12), "已成功清空所有网址书签链接 (12 个)");
  });
});
