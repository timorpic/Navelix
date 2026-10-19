import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PROJECT_STATUS,
  displayProjectStatus,
  isCompletedStatus,
  normalizeProjectStatus,
  PROJECT_STATUS_KEYS,
  PROJECT_STATUS_LABELS_ZH,
  PROJECT_STATUS_TRANSLATION_KEYS,
  projectStatusLabelZh,
  projectStatusOptions,
  toStoredStatus,
} from "../project-status.ts";
import zhCN from "../../../messages/zh-CN.json" with { type: "json" };
import en from "../../../messages/en.json" with { type: "json" };

/**
 * 项目状态归一化单测。
 *
 * 这里是「历史数据兼容层」的边界：线上库里同时存在规范键、中文文案、
 * 英文文案和用户自定义状态。改这里的判定顺序会直接影响首页统计与
 * AI 提示词，因此把每条规则固定成断言。
 */

const dict = (locale: Record<string, unknown>, key: string) => {
  const value = locale[key];
  return typeof value === "string" ? value : undefined;
};

describe("normalizeProjectStatus", () => {
  it("规范键原样识别", () => {
    for (const key of PROJECT_STATUS_KEYS) {
      assert.equal(normalizeProjectStatus(key), key);
    }
  });

  it("中文历史值识别", () => {
    assert.equal(normalizeProjectStatus("进行中"), "in-progress");
    assert.equal(normalizeProjectStatus("研究中"), "research");
    assert.equal(normalizeProjectStatus("维护中"), "maintenance");
    assert.equal(normalizeProjectStatus("已完成"), "completed");
  });

  it("英文历史值大小写与空白不敏感", () => {
    assert.equal(normalizeProjectStatus("  In Progress "), "in-progress");
    assert.equal(normalizeProjectStatus("Completed"), "completed");
    assert.equal(normalizeProjectStatus("RESEARCH"), "research");
    assert.equal(normalizeProjectStatus("maintenance"), "maintenance");
  });

  it("复合状态按「已完成优先」判定，不被包含匹配抢走", () => {
    assert.equal(normalizeProjectStatus("已完成开发"), "completed");
    assert.equal(normalizeProjectStatus("已上线"), "completed");
  });

  it("否定式状态归入进行中而非已完成", () => {
    for (const raw of ["未完成", "未开始", "待开始", "not started", "pending", "todo", "backlog"]) {
      assert.equal(normalizeProjectStatus(raw), "in-progress", raw);
    }
  });

  it("空值回退默认状态", () => {
    assert.equal(normalizeProjectStatus(""), DEFAULT_PROJECT_STATUS);
    assert.equal(normalizeProjectStatus("   "), DEFAULT_PROJECT_STATUS);
    assert.equal(normalizeProjectStatus(undefined), DEFAULT_PROJECT_STATUS);
    assert.equal(normalizeProjectStatus(null), DEFAULT_PROJECT_STATUS);
  });

  it("自定义状态返回 null（调用方保留原值，统计计入 other）", () => {
    assert.equal(normalizeProjectStatus("搁置"), null);
    assert.equal(normalizeProjectStatus("blocked"), null);
  });
});

describe("toStoredStatus", () => {
  it("可识别的变体写入时归一化为规范键", () => {
    assert.equal(toStoredStatus("进行中"), "in-progress");
    assert.equal(toStoredStatus("In Progress"), "in-progress");
    assert.equal(toStoredStatus("已完成"), "completed");
  });

  it("空值写入默认状态", () => {
    assert.equal(toStoredStatus(""), DEFAULT_PROJECT_STATUS);
    assert.equal(toStoredStatus(undefined), DEFAULT_PROJECT_STATUS);
  });

  it("自定义状态原样保留，不静默改写用户数据", () => {
    assert.equal(toStoredStatus("搁置"), "搁置");
    assert.equal(toStoredStatus(" Blocked "), "Blocked");
  });
});

describe("展示与文案", () => {
  it("规范键走字典翻译键", () => {
    const translate = (key: string) => `t:${key}`;
    assert.equal(displayProjectStatus("in-progress", translate), "t:in_progress_dc9591e5");
    assert.equal(displayProjectStatus("已完成", translate), "t:completed_f28461bb");
  });

  it("自定义状态原样展示", () => {
    const translate = (key: string) => `t:${key}`;
    assert.equal(displayProjectStatus("搁置", translate), "搁置");
  });

  it("中文标签用于服务端提示词", () => {
    assert.equal(projectStatusLabelZh("in-progress"), "进行中");
    assert.equal(projectStatusLabelZh("In Progress"), "进行中");
    assert.equal(projectStatusLabelZh("custom"), "custom");
  });

  it("每个翻译键在 zh-CN 与 en 字典中都存在（i18n 扫描无法覆盖本模块）", () => {
    for (const key of PROJECT_STATUS_KEYS) {
      const translationKey = PROJECT_STATUS_TRANSLATION_KEYS[key];
      assert.ok(dict(zhCN, translationKey), `zh-CN 缺少 ${translationKey}`);
      assert.ok(dict(en, translationKey), `en 缺少 ${translationKey}`);
      assert.ok(PROJECT_STATUS_LABELS_ZH[key], `缺少中文标签 ${key}`);
    }
  });
});

describe("projectStatusOptions", () => {
  it("默认给出四个规范键", () => {
    assert.deepEqual(
      projectStatusOptions().map((o) => o.value),
      [...PROJECT_STATUS_KEYS],
    );
  });

  it("自定义状态作为额外选项保留，避免编辑保存时被改写", () => {
    const options = projectStatusOptions("搁置").map((o) => o.value);
    assert.ok(options.includes("搁置"));
    assert.equal(options.length, PROJECT_STATUS_KEYS.length + 1);
  });

  it("可识别的历史值不重复追加选项", () => {
    assert.equal(projectStatusOptions("进行中").length, PROJECT_STATUS_KEYS.length);
  });
});

describe("isCompletedStatus", () => {
  it("识别各语言与变体", () => {
    for (const raw of ["completed", "已完成", "DONE", "已完成开发"]) {
      assert.equal(isCompletedStatus(raw), true, raw);
    }
    for (const raw of ["进行中", "未完成", "research", ""]) {
      assert.equal(isCompletedStatus(raw), false, raw);
    }
  });
});
