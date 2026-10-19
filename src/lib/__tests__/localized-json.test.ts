import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import sourceIndex from "../../../messages/source-index.json" with { type: "json" };
import en from "../../../messages/en.json" with { type: "json" };
import zh from "../../../messages/zh-CN.json" with { type: "json" };

/**
 * `localizedJson` 只对能在 `source-index.json` 中查到 source 的错误串做翻译；
 * 查不到就原样返回中文。这个静态检查保证新增路由里的字面量错误都有英文文案，
 * 动态拼接的（`err.message`、模板串）不在此列，由调用方自行决定是否兜底。
 */

interface Candidate {
  file: string;
  source: string;
}

function scanRoutes(directory: string): Candidate[] {
  const found: Candidate[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...scanRoutes(file));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    const content = fs.readFileSync(file, "utf8");
    // 只取 localizedJson({ ... error: "字面量" ... }) 中的第一个错误字段
    for (const match of content.matchAll(/localizedJson\(\{([\s\S]{0,600}?)\}/g)) {
      const literal = match[1].match(/error:\s*"((?:[^"\\]|\\.)*)"/);
      if (literal) found.push({ file, source: literal[1] });
    }
  }
  return found;
}

describe("localizedJson error literals", () => {
  const candidates = scanRoutes(path.join("src", "app", "api"));
  const index = sourceIndex as Record<string, string>;

  it("every string-literal error has an English translation", () => {
    assert.ok(candidates.length > 0, "expected to find localizedJson error literals");
    const missing = candidates.filter(({ source }) => !(source in index));
    assert.deepEqual(
      missing.map(({ file, source }) => `${file}: ${source}`),
      [],
      "add the source to messages/source-index.json and both dictionaries",
    );
  });

  it("indexed keys exist in both dictionaries", () => {
    const used = new Set(candidates.map(({ source }) => index[source]).filter(Boolean));
    for (const key of used) {
      assert.ok(key in zh, `zh-CN.json missing ${key}`);
      assert.ok(key in en, `en.json missing ${key}`);
    }
  });
});
