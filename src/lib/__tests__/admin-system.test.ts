import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  antigravitySaveNotice,
  bookmarkImportSummary,
  buildFullExportPayload,
  fullBackupFileName,
  fullExportSummary,
  fullImportSummary,
  formatUpdateTime,
  normalizeAntigravitySecret,
  parseAntigravitySaveResult,
  parseAntigravitySettings,
  parseCachePurgeResult,
  parseDbRestoreResult,
  parseFullImportPayload,
  readLocalExportState,
  stripConfigSecrets,
  sunPanelImportSummary,
  updateCheckFailureResult,
  versionLabel,
  writeLocalExportState,
  FOCUS_TRACKER_KEY,
  LINK_USAGE_KEY,
  QUICK_NOTES_KEY,
  FALLBACK_VERSION,
} from "../admin-system.ts";

/**
 * 「系统运维与安全」Tab 的纯逻辑单测。
 *
 * 这些函数原先内联在 `admin-system-tab.tsx`（928 行的巨石组件）的 handler 里，
 * 无法被测试覆盖；抽出到 lib 后在此固定住响应解析、载荷组装、密钥剔除与
 * 本地数据读写的行为，防止后续重构悄悄改变导出文件结构或提示文案。
 */

/** 最小 Storage 桩：只实现被测代码用到的 getItem / setItem。 */
function createStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    raw: map,
  };
}

describe("versionLabel", () => {
  // 断言引用 FALLBACK_VERSION 而非硬编码字面量：该常量由 sync-version.mjs 同步，
  // 写死会让每次发版都失败一次（v2.9.5 → v2.10.0 时即如此）。
  test("缺少版本号时回退内置默认版本", () => {
    assert.equal(versionLabel(null), FALLBACK_VERSION);
    assert.equal(versionLabel(undefined), FALLBACK_VERSION);
    assert.equal(versionLabel(""), FALLBACK_VERSION);
    assert.match(FALLBACK_VERSION, /^v\d+\.\d+\.\d+$/, "兜底版本号应为带 v 前缀的语义化版本");
  });

  test("缺少 v 前缀时补齐，已有前缀保持原样", () => {
    assert.equal(versionLabel("2.10.0"), "v2.10.0");
    assert.equal(versionLabel("v2.10.0"), "v2.10.0");
  });
});

describe("formatUpdateTime", () => {
  test("按 zh-CN 本地化输出，非法日期不抛异常", () => {
    assert.equal(formatUpdateTime("2026-08-20T00:00:00.000Z"), new Date("2026-08-20T00:00:00.000Z").toLocaleString("zh-CN"));
    assert.equal(typeof formatUpdateTime("not-a-date"), "string");
  });
});

describe("updateCheckFailureResult", () => {
  test("兜底结果固定为错误文案 + 空 local + null remote", () => {
    assert.deepEqual(updateCheckFailureResult(), {
      local: { sourceSha: null, buildDate: null, version: null, isDockerBuild: false },
      remote: null,
      updateAvailable: null,
      error: "检查失败，请稍后重试",
    });
  });
});

describe("parseAntigravitySettings", () => {
  test("缺少 antigravityClientSecretConfigured 布尔标记时视为无效响应", () => {
    assert.equal(parseAntigravitySettings(null), null);
    assert.equal(parseAntigravitySettings({}), null);
    assert.equal(parseAntigravitySettings({ antigravityClientSecretConfigured: "yes" }), null);
  });

  test("取 isCustomSecret（非布尔时按 false）", () => {
    assert.deepEqual(
      parseAntigravitySettings({ antigravityClientSecretConfigured: true, isCustomSecret: true }),
      { isCustomSecret: true },
    );
    assert.deepEqual(
      parseAntigravitySettings({ antigravityClientSecretConfigured: false }),
      { isCustomSecret: false },
    );
  });
});

describe("parseAntigravitySaveResult", () => {
  test("取保存响应里的 isCustomSecret 标记", () => {
    assert.deepEqual(parseAntigravitySaveResult({ success: true, isCustomSecret: true }), {
      isCustomSecret: true,
    });
    assert.deepEqual(parseAntigravitySaveResult(undefined), { isCustomSecret: false });
  });
});

describe("normalizeAntigravitySecret", () => {
  test("去除首尾空白，纯空白归一为空串（由调用方判定不保存）", () => {
    assert.equal(normalizeAntigravitySecret("  GOCSPX-abc  "), "GOCSPX-abc");
    assert.equal(normalizeAntigravitySecret("   "), "");
  });
});

describe("antigravitySaveNotice", () => {
  test("成功为固定文案，失败取服务端 error 并回退默认", () => {
    assert.equal(antigravitySaveNotice(true, {}), "✅ 反重力 OAuth 客户端密钥已保存");
    assert.equal(antigravitySaveNotice(false, { error: "CSRF 验证失败" }), "❌ CSRF 验证失败");
    assert.equal(antigravitySaveNotice(false, {}), "❌ 保存失败");
  });
});

describe("parseDbRestoreResult", () => {
  test("成功带服务端 message，缺失时回退默认文案", () => {
    assert.deepEqual(parseDbRestoreResult(true, { message: "数据库已成功还原恢复！" }), {
      ok: true,
      notice: "✅ 数据库已成功还原恢复！",
    });
    assert.deepEqual(parseDbRestoreResult(true, {}), {
      ok: true,
      notice: "✅ 数据库已成功还原",
    });
  });

  test("失败取 error，缺失时回退默认文案", () => {
    assert.deepEqual(parseDbRestoreResult(false, { error: "数据库恢复失败: 坏文件" }), {
      ok: false,
      notice: "❌ 数据库恢复失败: 坏文件",
    });
    assert.deepEqual(parseDbRestoreResult(false, null), {
      ok: false,
      notice: "❌ 还原失败",
    });
  });
});

describe("parseCachePurgeResult", () => {
  test("成功同时给出内联提示与通知中心文案", () => {
    const outcome = parseCachePurgeResult(true, { message: "清理维护已完成，共释放/清理了 3 条历史操作记录" });
    assert.equal(outcome.ok, true);
    assert.equal(outcome.message, "清理维护已完成，共释放/清理了 3 条历史操作记录");
    assert.equal(outcome.notice, "✅ 清理维护已完成，共释放/清理了 3 条历史操作记录");
  });

  test("失败只给内联提示，通知文案为空", () => {
    const outcome = parseCachePurgeResult(false, { error: "无权访问，仅管理员可执行清理操作" });
    assert.deepEqual(outcome, {
      ok: false,
      notice: "❌ 无权访问，仅管理员可执行清理操作",
      message: "",
    });
    assert.deepEqual(parseCachePurgeResult(false, undefined), {
      ok: false,
      notice: "❌ 清理失败",
      message: "",
    });
  });
});

describe("stripConfigSecrets", () => {
  test("剔除 aiApiKey 与 weatherApiKey，不改动原对象", () => {
    const original = { siteTitle: "工作台", aiApiKey: "sk-secret", weatherApiKey: "w-secret" };
    const safe = stripConfigSecrets(original);
    assert.deepEqual(safe, { siteTitle: "工作台" });
    // 原对象保持完整（浅拷贝语义）
    assert.equal(original.aiApiKey, "sk-secret");
  });

  test("无密钥字段时原样返回同值", () => {
    assert.deepEqual(stripConfigSecrets({ theme: "dark" }), { theme: "dark" });
  });
});

describe("buildFullExportPayload", () => {
  test("接口数据优先，缺失字段回退当前页面数据", () => {
    const payload = buildFullExportPayload({
      dbData: { links: [{ id: "l1" } as never] },
      fallbackConfig: { siteTitle: "回退标题", aiApiKey: "sk-x" },
      fallbackCategories: [{ id: "c1" } as never],
      fallbackLinks: [{ id: "l0" } as never, { id: "l9" } as never],
      localStorageData: { focusTracker: null, quickNotes: null, linkUsage: null },
      now: new Date("2026-08-20T00:00:00.000Z"),
    });
    assert.equal(payload.version, "2.0");
    assert.equal(payload.exportTime, "2026-08-20T00:00:00.000Z");
    assert.deepEqual(payload.links, [{ id: "l1" }]);
    assert.deepEqual(payload.categories, [{ id: "c1" }]);
    assert.deepEqual(payload.projects, []);
    assert.deepEqual(payload.todos, []);
    // config 走回退分支并被剔除密钥
    assert.deepEqual(payload.config, { siteTitle: "回退标题" });
  });

  test("接口返回空数组时保留空数组而非回退（|| 语义）", () => {
    const payload = buildFullExportPayload({
      dbData: { categories: [], links: [] },
      fallbackConfig: {},
      fallbackCategories: [{ id: "c1" } as never],
      fallbackLinks: [{ id: "l1" } as never],
      localStorageData: { focusTracker: null, quickNotes: null, linkUsage: null },
    });
    assert.deepEqual(payload.categories, []);
    assert.deepEqual(payload.links, []);
  });
});

describe("fullBackupFileName", () => {
  test("文件名带毫秒时间戳（取整）", () => {
    assert.equal(
      fullBackupFileName(new Date(1786680000000)),
      "navelix-full-backup-1786680000000.json",
    );
  });
});

describe("导出 / 导入摘要文案", () => {
  test("导出摘要统计链接、分组、项目与日程数", () => {
    assert.equal(
      fullExportSummary({
        categories: [{}, {}] as never,
        links: [{}] as never,
        projects: [{}] as never,
        todos: [{}, {}, {}] as never,
      }),
      "全量数据导出成功：包含 1 链接、2 分组、1 项目、3 日程",
    );
  });

  test("导入摘要统计恢复的链接、分组、项目与日程数", () => {
    assert.equal(
      fullImportSummary({
        categories: [{}] as never,
        links: [{}, {}] as never,
        projects: [] as never,
        todos: [{}] as never,
      }),
      "全网全量配置导入成功：恢复 2 链接、1 分组、0 项目、1 日程",
    );
  });

  test("书签与 Sun-Panel 导入摘要", () => {
    assert.equal(bookmarkImportSummary({ categories: 2, links: 5 }), "书签导入成功：合并添加 5 个链接");
    assert.equal(
      sunPanelImportSummary({ categories: 2, links: 5 }),
      "☀️ Sun-Panel 配置导入成功：解析并合并导入 5 个链接与 2 个分组",
    );
  });
});

describe("parseFullImportPayload", () => {
  test("分类 / 链接按必填字段过滤，非法项被丢弃", () => {
    const payload = parseFullImportPayload({
      categories: [
        { id: "c1", name: "开发工具" },
        { id: 1, name: "非法 id" },
        { id: "c2" },
        null,
      ],
      links: [
        { id: "l1", title: "GitHub", url: "https://github.com" },
        { id: "l2", title: "缺 url" },
        { id: "l3", url: "https://x.com" },
      ],
    });
    assert.equal(payload.categories.length, 1);
    assert.equal(payload.categories[0].id, "c1");
    assert.equal(payload.links.length, 1);
    assert.equal(payload.links[0].id, "l1");
  });

  test("非数组字段归一为空数组，缺失 config 为 undefined", () => {
    const payload = parseFullImportPayload({ categories: "oops", links: null, projects: {}, todos: 3 });
    assert.deepEqual(payload.categories, []);
    assert.deepEqual(payload.links, []);
    assert.deepEqual(payload.projects, []);
    assert.deepEqual(payload.todos, []);
    assert.equal(payload.config, undefined);
    assert.equal(payload.localStorageData, null);
  });

  test("导入的 config 同样剔除两个明文密钥", () => {
    const payload = parseFullImportPayload({
      config: { siteTitle: "恢复的标题", aiApiKey: "sk-x", weatherApiKey: "w-x" },
    });
    assert.deepEqual(payload.config, { siteTitle: "恢复的标题" });
  });

  test("null 输入不抛异常", () => {
    const payload = parseFullImportPayload(null);
    assert.deepEqual(payload.categories, []);
    assert.equal(payload.config, undefined);
  });
});

describe("readLocalExportState / writeLocalExportState", () => {
  test("读取三个 localStorage 键；缺失或坏 JSON 按 null", () => {
    const storage = createStorage({
      [FOCUS_TRACKER_KEY]: JSON.stringify({ "2026-08-20": 30 }),
      [QUICK_NOTES_KEY]: "{坏 JSON",
    });
    const state = readLocalExportState(storage);
    assert.deepEqual(state.focusTracker, { "2026-08-20": 30 });
    assert.equal(state.quickNotes, null);
    assert.equal(state.linkUsage, null);
  });

  test("写回时按真值判断，空值不覆盖既有数据", () => {
    const storage = createStorage({ [LINK_USAGE_KEY]: "旧值" });
    writeLocalExportState(storage, { focusTracker: { a: 1 }, quickNotes: null, linkUsage: null });
    assert.equal(storage.getItem(FOCUS_TRACKER_KEY), JSON.stringify({ a: 1 }));
    assert.equal(storage.getItem(QUICK_NOTES_KEY), null);
    // linkUsage 为空值 → 保留原有数据
    assert.equal(storage.getItem(LINK_USAGE_KEY), "旧值");
  });

  test("整个本地数据段缺失时不写入任何键", () => {
    const storage = createStorage();
    writeLocalExportState(storage, null);
    writeLocalExportState(storage, undefined);
    assert.equal(storage.raw.size, 0);
  });

  test("导出再导入可往返（roundtrip）", () => {
    const source = createStorage({
      [FOCUS_TRACKER_KEY]: JSON.stringify({ total: 3 }),
      [QUICK_NOTES_KEY]: JSON.stringify(["买菜"]),
      [LINK_USAGE_KEY]: JSON.stringify({ l1: { count: 2 } }),
    });
    const exported = readLocalExportState(source);
    const target = createStorage();
    writeLocalExportState(target, exported);
    assert.deepEqual(readLocalExportState(target), exported);
  });
});
