import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createTranslator } from "next-intl";
import en from "../../../messages/en.json" with { type: "json" };
import zh from "../../../messages/zh-CN.json" with { type: "json" };
import { browserLocale, normalizeLocale, isLocale } from "../i18n.ts";
import { translateText } from "../server-translations.ts";
import { validateConfigPatch } from "../config-validation.ts";
import { mapUserConfigRow, GLOBAL_SCOPE_CONFIG_KEYS } from "../user-config-columns.ts";
import { formatRelativeTime, toLocalDateStr } from "../date-utils.ts";
import { buildGanttTimeline } from "../gantt.ts";

describe("language preferences", () => {
  it("normalizes historical zh, defaults and supported regional English", () => {
    assert.equal(normalizeLocale("zh"), "zh-CN");
    assert.equal(normalizeLocale(undefined), "zh-CN");
    assert.equal(normalizeLocale("en-US"), "en");
    assert.equal(isLocale("en-US"), false);
    assert.equal(isLocale("en"), true);
    assert.equal(mapUserConfigRow({ language: "zh" }).language, "zh-CN");
    assert.equal(mapUserConfigRow({ language: "en" }).language, "en");
    assert.equal(GLOBAL_SCOPE_CONFIG_KEYS.has("language"), false);
  });
  it("negotiates supported browser languages by quality and rejects invalid patches", () => {
    assert.equal(browserLocale("fr-FR,en-US;q=0.9,zh-CN;q=0.7"), "en");
    assert.equal(browserLocale("en;q=0,zh-CN;q=0.8"), "zh-CN");
    assert.equal(browserLocale("de-DE"), "zh-CN");
    validateConfigPatch({ language: "en" });
    assert.throws(() => validateConfigPatch({ language: "fr" }));
    assert.throws(() => validateConfigPatch({ language: 1 }));
  });
});

describe("translation catalogs", () => {
  it("have matching keys, parameters and valid ICU messages in both languages", () => {
    assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
    for (const locale of ["zh-CN", "en"] as const) {
      const messages: Record<string, string> = locale === "en" ? en : zh;
      const tx = createTranslator({ locale, messages, onError(error) { throw error; } });
      for (const [key, message] of Object.entries(messages)) {
        const variables = Array.from(message.matchAll(/\{([a-zA-Z]\w*)\}/g), match => match[1]);
        const counterpart = (locale === "en" ? zh : en) as Record<string, string>;
        assert.deepEqual(variables.sort(), Array.from(counterpart[key].matchAll(/\{([a-zA-Z]\w*)\}/g), match => match[1]).sort(), key);
        assert.equal(typeof tx(key, Object.fromEntries(variables.map(name => [name, "Example"]))), "string", key);
      }
    }
  });
  it("translates known application templates and preserves embedded user content", () => {
    assert.equal(translateText("en", "保存"), "Save");
    assert.equal(translateText("en", '确定要删除链接 "中文标题" 吗？'), 'Delete link "中文标题"?');
    assert.equal(translateText("en", "用户原文，不应翻译"), "用户原文，不应翻译");
    assert.match(translateText("en", "📅 Navelix：待办 / 日历今日到期\n中文任务\n截止日期：2026-10-12"), /due today\n中文任务\nDue date: 2026-10-12/);
    assert.equal(translateText("zh", "保存"), "保存");
  });
  it("formats relative time and Gantt labels without changing calendar dates", () => {
    assert.equal(formatRelativeTime(Date.now() - 120_000, { locale: "en" }), "2 minutes ago");
    const today = toLocalDateStr();
    const english = buildGanttTimeline("day", 0, today, "en");
    const chinese = buildGanttTimeline("day", 0, today, "zh-CN");
    assert.deepEqual(english.columns.map(column => column.key), chinese.columns.map(column => column.key));
    assert.match(english.columns[0].subLabel, /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
    assert.match(english.timelineLabel, /^Daily planning:/);
  });
});

// Check actual call sites too, so a typo cannot silently render a message key in the UI.
it("all literal UI translation keys exist in the catalog", () => {
  const keys = new Set(Object.keys(zh));
  const scan = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { if (entry.name !== "__tests__") scan(file); }
      else if (/\.tsx?$/.test(file)) {
        const content = fs.readFileSync(file, "utf8");
        for (const match of content.matchAll(/\btx\("([^"\n]+)"/g)) assert.ok(keys.has(match[1]), `${file}: ${match[1]}`);
      }
    }
  };
  scan("src");
});
