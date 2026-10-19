import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  compactSearchText,
  highlightTerms,
  normalizeSearchText,
  parseSearchQuery,
  rankSearchItems,
  scoreSearchFields,
} from "../search.ts";

/**
 * 搜索 T0 回归用例。
 *
 * 原实现是 `toLowerCase().includes()` + `slice(0, 8)`：全角、分隔符
 * 与中文语序搜索都失效，结果也不按相关度排序。这里锁住归一化、
 * 打分与 top-N 行为。
 */

describe("normalizeSearchText / compactSearchText", () => {
  it("folds width, case and whitespace", () => {
    assert.equal(normalizeSearchText("  ＮＥＸＴ   JS  "), "next js");
    assert.equal(normalizeSearchText("ＵＩ设计"), "ui设计");
  });

  it("removes separators so Next.js and nextjs are equivalent", () => {
    assert.equal(compactSearchText("Next.js"), "nextjs");
    assert.equal(compactSearchText("next-js"), "nextjs");
    assert.equal(compactSearchText("next_js"), "nextjs");
  });
});

describe("parseSearchQuery", () => {
  it("splits on whitespace and generates 2-grams only for long CJK terms", () => {
    const [zh, ascii] = parseSearchQuery("服务器部署 Docker");
    assert.equal(zh.normalized, "服务器部署");
    assert.deepEqual(zh.bigrams, ["服务", "务器", "器部", "部署"]);
    assert.deepEqual(ascii.bigrams, []);
    assert.equal(ascii.normalized, "docker");
  });

  it("drops blank input", () => {
    assert.deepEqual(parseSearchQuery("   "), []);
  });
});

describe("scoreSearchFields", () => {
  const score = (query: string, fields: Parameters<typeof scoreSearchFields>[1]) =>
    scoreSearchFields(parseSearchQuery(query), fields);

  it("requires every term to hit at least one field", () => {
    assert.equal(score("alpha beta", [{ text: "alpha only", weight: 100 }]), null);
    assert.notEqual(score("alpha beta", [{ text: "alpha and beta", weight: 100 }]), null);
  });

  it("rewards prefix and word-boundary hits more than mid-word hits", () => {
    const title = [{ text: "navelix workspace", weight: 100 }];
    const prefix = score("navelix", title)!;
    const middle = score("workspace", title)!;
    assert.ok(prefix > middle, `${prefix} > ${middle}`);
  });

  it("weights title above description for the same hit", () => {
    const titleHit = score("deploy", [{ text: "deploy guide", weight: 100 }, { text: "", weight: 40 }])!;
    const descriptionHit = score("deploy", [{ text: "guide", weight: 100 }, { text: "deploy guide", weight: 40 }])!;
    assert.ok(titleHit > descriptionHit);
  });

  it("matches a Chinese long term against reordered words via 2-grams", () => {
    // 搜「服务器部署」应命中「部署服务器」
    assert.notEqual(score("服务器部署", [{ text: "部署服务器", weight: 100 }]), null);
  });

  it("does not match two-character CJK fragments inside a single long word by accident alone", () => {
    // 单个常见字组成的短词不会因一个 2-gram 命中整段无关文本
    assert.equal(score("设置", [{ text: "设计", weight: 100 }]), null);
  });
});

describe("rankSearchItems", () => {
  const items = [
    { id: "desc", title: "Guide", description: "How to deploy the server" },
    { id: "title", title: "Deploy checklist", description: "" },
    { id: "other", title: "Unrelated", description: "" },
  ];

  it("sorts by relevance before the caller truncates", () => {
    const ranked = rankSearchItems(items, {
      query: "deploy",
      fields: (item) => [{ text: item.title, weight: 100 }, { text: item.description, weight: 40 }],
    });
    assert.deepEqual(ranked.map((item) => item.id), ["title", "desc"]);
  });

  it("applies bonus without letting it outrank field weights", () => {
    const ranked = rankSearchItems(items, {
      query: "deploy",
      fields: (item) => [{ text: item.title, weight: 100 }, { text: item.description, weight: 40 }],
      bonus: (item) => (item.id === "desc" ? 20 : 0),
    });
    assert.deepEqual(ranked.map((item) => item.id), ["title", "desc"]);
  });

  it("is stable for equal scores and empty for blank queries", () => {
    const tied = [
      { id: "a", title: "same" },
      { id: "b", title: "same" },
    ];
    assert.deepEqual(rankSearchItems(tied, { query: "same", fields: (item) => [{ text: item.title, weight: 100 }] }).map((item) => item.id), ["a", "b"]);
    assert.deepEqual(rankSearchItems(tied, { query: "  ", fields: (item) => [{ text: item.title, weight: 100 }] }), []);
  });
});

describe("highlightTerms", () => {
  it("includes raw, normalized and compact forms with longest first", () => {
    const terms = highlightTerms("ＮＥＸＴ.js");
    assert.ok(terms.includes("ＮＥＸＴ.js"));
    assert.ok(terms.includes("next.js"));
    assert.ok(terms.includes("nextjs"));
    assert.equal(terms[0], "ＮＥＸＴ.js");
  });
});
