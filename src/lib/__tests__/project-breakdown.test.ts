import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateRuleBasedBreakdown,
  matchBreakdownCategory,
} from "../project-breakdown.ts";

/**
 * 规则拆解器的回归用例。
 *
 * 原实现用 `p.includes("ui")` / `p.includes("nas")` 做子串匹配，
 * "Build pipeline" 会命中设计模板、"canvas 可视化" 会命中部署模板。
 * 这里锁住词边界匹配与打分优先级。
 */
describe("matchBreakdownCategory", () => {
  it("does not match ASCII keywords inside longer words", () => {
    // build / guide / quick 都含 "ui"；canvas / analysis 都含 "nas"
    assert.equal(matchBreakdownCategory("Build pipeline").category, "generic");
    assert.equal(matchBreakdownCategory("User guide").category, "generic");
    assert.equal(matchBreakdownCategory("canvas 可视化").category, "generic");
    assert.equal(matchBreakdownCategory("Data analysis").category, "generic");
  });

  it("still matches whole ASCII words and Chinese substrings", () => {
    assert.equal(matchBreakdownCategory("UI refresh").category, "design");
    assert.equal(matchBreakdownCategory("NAS migration").category, "deploy");
    assert.equal(matchBreakdownCategory("官网改版").category, "design");
    assert.equal(matchBreakdownCategory("核心模块重构").category, "refactor");
  });

  it("scores instead of taking the first if-branch", () => {
    // 同时含部署与重构：部署关键词权重更高 → 部署
    const deployWins = matchBreakdownCategory("Docker 部署重构");
    assert.equal(deployWins.category, "deploy");
    // matchedKeywords 只记录胜出分类的命中词（另一分类的命中不混入）
    assert.deepEqual(deployWins.matchedKeywords, ["部署", "docker"]);

    // 重构词更多时反超
    assert.equal(matchBreakdownCategory("重构 优化 升级 refactor").category, "refactor");
  });

  it("returns generic with no keywords for empty or unknown names", () => {
    assert.deepEqual(matchBreakdownCategory(""), { category: "generic", matchedKeywords: [], score: 0 });
    assert.deepEqual(matchBreakdownCategory("普通项目"), { category: "generic", matchedKeywords: [], score: 0 });
  });
});

describe("generateRuleBasedBreakdown", () => {
  it("returns five dated tasks and reports the matched category", () => {
    const result = generateRuleBasedBreakdown("NAS 部署", "2026-10-19", { id: "u1", name: "管理员" });
    assert.equal(result.matchedCategory, "deploy");
    assert.equal(result.tasks.length, 5);
    assert.equal(result.tasks[0].dueDate, "2026-10-20");
    assert.equal(result.tasks[0].assigneeId, "u1");
    assert.equal(result.tasks[0].assigneeName, "管理员");
    assert.deepEqual(result.tasks.map((t) => t.priority), ["high", "high", "medium", "medium", "low"]);
  });

  it("keeps the generic template for names without keywords", () => {
    const result = generateRuleBasedBreakdown("普通项目", "2026-10-19");
    assert.equal(result.matchedCategory, "generic");
    assert.equal(result.tasks.length, 5);
    assert.match(result.tasks[0].title, /普通项目/);
  });

  it("localises titles when locale is en", () => {
    const result = generateRuleBasedBreakdown("Website redesign", "2026-10-19", undefined, "en");
    assert.equal(result.matchedCategory, "design");
    assert.match(result.tasks[0].title, /Website redesign/);
    assert.doesNotMatch(result.tasks[0].title, /[一-鿿]/);
  });
});
