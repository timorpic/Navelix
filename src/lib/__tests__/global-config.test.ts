import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import {
  diffConfigChanges,
  getGlobalConfigRow,
  saveGlobalConfig,
  splitConfigByScope,
} from "../global-config.ts";

/**
 * 全站配置单例核心测试：锚点解析 / 单例行读写 / diff 脱敏 / 多 admin 一致性。
 */

const A = "gc-test-admin-a";
const B = "gc-test-admin-b";

function cleanup() {
  for (const id of [A, B]) {
    db.prepare("DELETE FROM user_configs WHERE user_id = ?").run(id);
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
  }
  db.prepare("DELETE FROM system_settings WHERE key = 'logo_text'").run();
}

function seedAdmin(id: string, createdOffset: number) {
  db.prepare(
    "INSERT INTO users (id, username, password_hash, display_name, role, avatar, created_at) VALUES (?, ?, 'h', ?, 'admin', '', ?)",
  ).run(id, id, `Admin ${id}`, Date.now() + createdOffset);
}

describe("global-config: 独立系统设置", () => {
  beforeEach(cleanup);
  after(cleanup);
  it("系统配置不依赖用户行，删除管理员后保留", () => {
    seedAdmin(A, 0);
    saveGlobalConfig({ logoText: "品牌A" });
    db.prepare("DELETE FROM users WHERE id = ?").run(A);
    assert.equal(getGlobalConfigRow().logo_text, "品牌A");
    assert.equal(db.prepare("SELECT 1 FROM system_settings WHERE key = 'global_config_user_id'").get(), undefined);
  });
  it("用户行的旧全站列不能影响系统配置", () => {
    seedAdmin(A, 0);
    db.prepare("INSERT INTO user_configs (user_id, logo_text) VALUES (?, '旧值')").run(A);
    saveGlobalConfig({ logoText: "新值" });
    assert.equal(getGlobalConfigRow().logo_text, "新值");
  });
});

describe("global-config: diff 与密钥脱敏", () => {
  beforeEach(cleanup);
  after(cleanup);

  it("只记录真正变化的字段", () => {
    const current = { logo_text: "A", theme: "dark" } as Record<string, unknown>;
    const cfg = { logoText: "B", theme: "dark" } as Record<string, unknown>;
    const changes = diffConfigChanges(current, cfg);
    assert.equal(changes.length, 1);
    assert.deepEqual(changes[0], { field: "logoText", from: "A", to: "B" });
  });

  it("密钥字段脱敏，不泄露明文", () => {
    const current = { ai_api_key: "" } as Record<string, unknown>;
    const cfg = { aiApiKey: "sk-super-secret" } as Record<string, unknown>;
    const changes = diffConfigChanges(current, cfg);
    assert.equal(changes.length, 1);
    assert.equal(changes[0].field, "aiApiKey");
    assert.ok(!JSON.stringify(changes).includes("sk-super-secret"), "不得包含明文密钥");
  });

  it("密钥留空不产生变更", () => {
    const current = { ai_api_key: "" } as Record<string, unknown>;
    assert.equal(diffConfigChanges(current, { aiApiKey: "" }).length, 0);
  });
});

describe("global-config: scope 拆分（全站 vs 个人偏好）", () => {
  beforeEach(cleanup);
  after(cleanup);

  it("把品牌/AI/天气/社交/安全/探针归入全站，把外观偏好归入个人", () => {
    const { global, personal } = splitConfigByScope({
      // 全站级
      siteTitle: "站点",
      aiBaseUrl: "https://api.x.com",
      aiApiKey: "sk-x",
      weatherEnabled: true,
      socialGithub: "https://github.com/a",
      allowRegistration: true,
      customCss: "body{}",
      linkStatusInterval: 120,
      // 个人偏好
      theme: "dark",
      showSearchBar: false,
      wallpaperMode: "bing",
      sidebarDefaultState: "collapsed",
      maxWidth: "full",
      linkOpenTarget: "_self",
    });

    assert.deepEqual(Object.keys(global).sort(), [
      "aiApiKey",
      "aiBaseUrl",
      "allowRegistration",
      "customCss",
      "linkStatusInterval",
      "siteTitle",
      "socialGithub",
      "weatherEnabled",
    ]);
    assert.deepEqual(Object.keys(personal).sort(), [
      "linkOpenTarget",
      "maxWidth",
      "showSearchBar",
      "sidebarDefaultState",
      "theme",
      "wallpaperMode",
    ]);
  });

  it("密钥派生标记随密钥字段归入全站", () => {
    const { global, personal } = splitConfigByScope({ aiKeyConfigured: true, theme: "dark" });
    assert.ok("aiKeyConfigured" in global);
    assert.ok(!("aiKeyConfigured" in personal));
  });
});
