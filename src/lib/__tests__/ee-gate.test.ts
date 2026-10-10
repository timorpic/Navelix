import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { applyEEGateToConfig, getProFeatureFlags } from "../ee-gate.ts";
import { saveLicenseKey, removeLicenseKey } from "../license.ts";
import { registerEEDrivers } from "../ee-bridge/index.ts";
import { DEFAULT_SITE_TITLE } from "../constants.ts";
import type { SystemConfig } from "@/types";

/**
 * EE 门禁单测。
 *
 * 背景：`(app)/layout.tsx` 的 SSR 路径此前直接调用 `getUserData()`，
 * 绕过了 API 侧唯一的 Pro 字段降级收口。本测试锁定降级规则本身，
 * 确保 CE 与 Pro 两种状态下行为符合预期。
 */
describe("EE Gate (Pro 特性门禁)", () => {
  const { publicKey: testPublicKey, privateKey: testPrivateKey } =
    crypto.generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

  // 注册测试公钥；同时提供两个 driver 使 isEEAvailable() 返回 true，
  // 从而让 canAccessFeature 的判定真正取决于 License 内容。
  registerEEDrivers({
    officialPublicKey: testPublicKey,
    storageDriver: {
      testConnection: async () => ({ success: true, message: "" }),
      uploadBackup: async () => ({ success: true }),
      listBackups: async () => [],
      downloadBackup: async () => ({ success: true }),
    },
    probeDriver: {
      probeUrl: async (url: string) => ({ url, status: "online" as const, latencyMs: 1 }),
      probeUrls: async (urls: string[]) =>
        urls.map((url) => ({ url, status: "online" as const, latencyMs: 1 })),
    },
  });

  function issueTestToken(features: string[], plan = "pro_lifetime"): string {
    const payloadStr = JSON.stringify({
      licenseId: `NVL-GATE-${Date.now()}-${Math.random()}`,
      customer: "门禁测试",
      email: "gate@example.com",
      plan,
      features,
      issuedAt: Date.now(),
      expiresAt: 0,
    });
    const payloadBase64 = Buffer.from(payloadStr, "utf8").toString("base64url");
    const signature = crypto.sign(null, Buffer.from(payloadStr, "utf8"), testPrivateKey);
    return `${payloadBase64}.${signature.toString("base64url")}`;
  }

  function proConfig(): SystemConfig {
    return {
      logoText: "自定义品牌",
      logoImage: "https://example.com/logo.png",
      siteTitle: "我的站点",
      customHeadScripts: "<script src='https://tracker.example.com/x.js'></script>",
      customCss: "body { color: red; }",
      linkStatusEnabled: true,
      linkStatusInterval: 300,
    } as SystemConfig;
  }

  after(() => {
    removeLicenseKey();
  });

  it("CE 环境（无有效 License）应清空全部 Pro 字段", () => {
    removeLicenseKey();

    const flags = getProFeatureFlags();
    assert.equal(flags.hasCodeInject, false);
    assert.equal(flags.hasBrandCustom, false);
    assert.equal(flags.hasProbes, false);

    const config = applyEEGateToConfig(proConfig());
    assert.equal(config.logoText, "Navelix", "品牌名应回落默认值");
    assert.equal(config.logoImage, "", "自定义 Logo 应被清空");
    assert.equal(config.siteTitle, DEFAULT_SITE_TITLE, "站点标题应回落默认值");
    assert.equal(config.customHeadScripts, "", "自定义脚本必须被清空（CSP 绕过点）");
    assert.equal(config.customCss, "", "自定义 CSS 必须被清空");
    assert.equal(config.linkStatusEnabled, false, "探针应被关闭");
    assert.equal(config.linkStatusInterval, 60, "探针间隔应复位默认值");
  });

  it("Pro 授权应原样保留全部 Pro 字段", () => {
    const saveRes = saveLicenseKey(
      issueTestToken(["brand_customization", "custom_code_injection", "link_status_monitor"]),
    );
    assert.equal(saveRes.valid, true, "测试 License 应验签通过");

    const flags = getProFeatureFlags();
    assert.equal(flags.hasCodeInject, true);
    assert.equal(flags.hasBrandCustom, true);
    assert.equal(flags.hasProbes, true);

    const before = proConfig();
    const config = applyEEGateToConfig(proConfig());
    assert.equal(config.logoText, before.logoText);
    assert.equal(config.logoImage, before.logoImage);
    assert.equal(config.siteTitle, before.siteTitle);
    assert.equal(config.customHeadScripts, before.customHeadScripts);
    assert.equal(config.customCss, before.customCss);
    assert.equal(config.linkStatusEnabled, true);
    assert.equal(config.linkStatusInterval, 300);
  });

  it("部分授权应只放行对应字段（品牌放行、注入与探针仍降级）", () => {
    saveLicenseKey(issueTestToken(["brand_customization"]));

    const config = applyEEGateToConfig(proConfig());
    // 品牌放行
    assert.equal(config.logoText, "自定义品牌");
    assert.equal(config.logoImage, "https://example.com/logo.png");
    assert.equal(config.siteTitle, "我的站点");
    // 注入与探针仍降级
    assert.equal(config.customHeadScripts, "");
    assert.equal(config.customCss, "");
    assert.equal(config.linkStatusEnabled, false);
    assert.equal(config.linkStatusInterval, 60);
  });

  it("通配符授权应放行全部三项", () => {
    saveLicenseKey(issueTestToken(["*"]));

    const flags = getProFeatureFlags();
    assert.equal(flags.hasCodeInject, true);
    assert.equal(flags.hasBrandCustom, true);
    assert.equal(flags.hasProbes, true);
  });

  it("removeLicenseKey 后应立刻回落为 CE 行为（缓存不得滞留旧状态）", () => {
    saveLicenseKey(issueTestToken(["*"]));
    assert.equal(getProFeatureFlags().hasBrandCustom, true);

    removeLicenseKey();
    // 关键：同进程内注销后必须立即失效，验证 License 缓存不产生陈旧读
    assert.equal(getProFeatureFlags().hasBrandCustom, false);
    assert.equal(applyEEGateToConfig(proConfig()).customCss, "");
  });
});
