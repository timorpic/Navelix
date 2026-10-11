import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import {
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  resolveAIConfig,
  validateAIBaseUrl,
} from "../ai-provider.ts";
import { encryptSecret } from "../secret.ts";
import { setSystemSetting } from "../system-settings.ts";

/**
 * AI 配置解析测试。
 *
 * 回归背景：4 个 AI 路由此前各自重写一遍「读 ai_* 三列 + 默认值 + 解密 + 拼 URL」，
 * 其中 summarize 的 URL 拼法与其余三处漂移（用 replace 正则而非 endsWith 判断）。
 * AI 配置自 v14 起为全站单例：测试将全局配置锚点钉到自己的测试用户，保证隔离与确定性。
 */

const USER_ID = "ai-provider-test-user";

function cleanup() {
  db.prepare("DELETE FROM user_configs WHERE user_id = ?").run(USER_ID);
  db.prepare("DELETE FROM users WHERE id = ?").run(USER_ID);
  db.prepare("DELETE FROM system_settings WHERE key IN ('ai_base_url', 'ai_model', 'ai_api_key')").run();
}

function seedUser() {
  cleanup();
  db.prepare(
    "INSERT INTO users (id, username, password_hash, display_name, role, avatar, created_at) VALUES (?, ?, 'h', 'AI 测试', 'admin', '', ?)",
  ).run(USER_ID, USER_ID, Date.now());
  db.prepare("INSERT INTO user_configs (user_id) VALUES (?)").run(USER_ID);

}

function setAIConfig(baseUrl: string | null, model: string | null, key?: string) {
  if (baseUrl !== null) setSystemSetting("ai_base_url", baseUrl);
  if (model !== null) setSystemSetting("ai_model", model);
  if (key !== undefined) setSystemSetting("ai_api_key", encryptSecret(key));
}

describe("ai-provider: resolveAIConfig", () => {
  beforeEach(seedUser);
  after(cleanup);

  it("未配置时应回落官方默认值", () => {
    setAIConfig("", "", "");
    const cfg = resolveAIConfig();
    assert.equal(cfg.baseUrl, DEFAULT_AI_BASE_URL);
    assert.equal(cfg.modelName, DEFAULT_AI_MODEL);
    assert.equal(cfg.apiKey, "", "未配置密钥时应为空串");
    assert.equal(cfg.targetUrl, `${DEFAULT_AI_BASE_URL}/chat/completions`);
  });

  it("应解密密钥并去除 BaseURL 尾部斜杠", () => {
    setAIConfig("https://api.example.com/v1///", "my-model", "sk-secret-123");
    const cfg = resolveAIConfig();
    assert.equal(cfg.apiKey, "sk-secret-123", "密钥应被正确解密");
    assert.equal(cfg.baseUrl, "https://api.example.com/v1", "尾部斜杠应被去除");
    assert.equal(cfg.modelName, "my-model");
    assert.equal(cfg.targetUrl, "https://api.example.com/v1/chat/completions");
  });

  it("BaseURL 已含 /chat/completions 时不应重复拼接", () => {
    setAIConfig("https://api.example.com/v1/chat/completions", null, "k");
    const cfg = resolveAIConfig();
    assert.equal(
      cfg.targetUrl,
      "https://api.example.com/v1/chat/completions",
      "不应拼成 .../chat/completions/chat/completions",
    );
  });

  it("尾部斜杠 + 已含端点 的组合应正确归一", () => {
    setAIConfig("https://api.example.com/v1/chat/completions/", null, "k");
    const cfg = resolveAIConfig();
    assert.equal(cfg.targetUrl, "https://api.example.com/v1/chat/completions");
  });
});

describe("ai-provider: validateAIBaseUrl", () => {
  it("合法 http/https 地址应通过", () => {
    assert.equal(validateAIBaseUrl("https://api.openai.com/v1"), null);
    assert.equal(validateAIBaseUrl("http://localhost:8080/v1"), null);
  });

  it("非法格式应返回错误文案", () => {
    const err = validateAIBaseUrl("not-a-url");
    assert.ok(err, "应返回错误文案");
    assert.match(err!, /格式不正确/);
  });

  it("非 http/https 协议应被拒绝", () => {
    const err = validateAIBaseUrl("ftp://example.com/v1");
    assert.ok(err, "应返回错误文案");
    assert.match(err!, /http\/https/);
  });
});
