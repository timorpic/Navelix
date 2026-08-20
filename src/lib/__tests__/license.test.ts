import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  verifyLicenseKey,
  saveLicenseKey,
  getLicenseStatus,
  removeLicenseKey,
  canAccessFeature,
} from "../license.ts";
import { registerEEDrivers } from "../ee-bridge/index.ts";

describe("Navelix Pro Offline License & Cryptographic Verification", () => {
  // 测试套件在内存中动态生成临时 Ed25519 密钥对，杜绝任何真实发牌私钥泄露
  const { publicKey: testPublicKey, privateKey: testPrivateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  // 将测试公钥注册到全局 EE 单例中进行验签
  registerEEDrivers({ officialPublicKey: testPublicKey });

  function issueTestToken(payloadObj: Record<string, unknown>, privateKey = testPrivateKey): string {
    const payloadStr = JSON.stringify(payloadObj);
    const payloadBase64 = Buffer.from(payloadStr, "utf8").toString("base64url");
    const signature = crypto.sign(null, Buffer.from(payloadStr, "utf8"), privateKey);
    const signatureBase64 = signature.toString("base64url");
    return `${payloadBase64}.${signatureBase64}`;
  }

  it("should successfully verify a valid Pro lifetime license", () => {
    const payload = {
      licenseId: "NVL-TEST-001",
      customer: "测试企业",
      email: "corp@example.com",
      plan: "pro_lifetime",
      features: ["brand_customization", "custom_code_injection", "s3_backup"],
      issuedAt: Date.now(),
      expiresAt: 0,
      maxSeats: 5,
    };

    const token = issueTestToken(payload);
    const res = verifyLicenseKey(token);

    assert.equal(res.valid, true, "有效签名应当验签成功");
    assert.equal(res.payload?.customer, "测试企业");
    assert.equal(res.payload?.plan, "pro_lifetime");
    assert.equal(res.payload?.expiresAt, 0);
  });

  it("should reject tampered payload or signature", () => {
    const payload = {
      licenseId: "NVL-TEST-002",
      customer: "原始客户",
      email: "corp@example.com",
      plan: "pro_lifetime",
      features: ["brand_customization"],
      issuedAt: Date.now(),
      expiresAt: 0,
    };

    const token = issueTestToken(payload);
    const [, signatureBase64] = token.split(".");

    // 篡改 payload (修改客户名为黑客)
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...payload, customer: "恶意篡改者" }),
      "utf8",
    ).toString("base64url");
    const tamperedToken = `${tamperedPayload}.${signatureBase64}`;

    const res = verifyLicenseKey(tamperedToken);
    assert.equal(res.valid, false, "被篡改的内容应当验签失败");
  });

  it("should reject expired licenses", () => {
    const expiredPayload = {
      licenseId: "NVL-TEST-003",
      customer: "过期客户",
      email: "corp@example.com",
      plan: "pro_annual",
      features: ["brand_customization"],
      issuedAt: Date.now() - 400 * 24 * 60 * 60 * 1000,
      expiresAt: Date.now() - 35 * 24 * 60 * 60 * 1000, // 35天前已到期
    };

    const token = issueTestToken(expiredPayload);
    const res = verifyLicenseKey(token);

    assert.equal(res.valid, false);
    assert.match(res.error || "", /到期/);
  });

  it("should save and check feature access correctly in database", () => {
    // 1. 先注销当前 License
    removeLicenseKey();
    let status = getLicenseStatus();
    assert.equal(status.isPro, false, "未激活时 isPro 应为 false");
    assert.equal(canAccessFeature("brand_customization"), false);

    // 2. 签发并保存一个包含 brand_customization 但不包含 custom_code_injection 的测试 License
    const partialPayload = {
      licenseId: "NVL-TEST-004",
      customer: "部分授权客户",
      email: "partial@example.com",
      plan: "pro_lifetime",
      features: ["brand_customization"],
      issuedAt: Date.now(),
      expiresAt: 0,
    };

    const partialToken = issueTestToken(partialPayload);
    const saveRes = saveLicenseKey(partialToken);
    assert.equal(saveRes.valid, true);

    status = getLicenseStatus();
    assert.equal(status.isPro, true);
    assert.equal(canAccessFeature("brand_customization"), true, "应允许访问 brand_customization");
    assert.equal(canAccessFeature("custom_code_injection"), false, "未授权特性应拒绝");

    // 3. 注销 License
    removeLicenseKey();
    status = getLicenseStatus();
    assert.equal(status.isPro, false);
  });

  it("should enforce hardware/instance fingerprint binding correctly", async () => {
    const { getMachineFingerprint } = await import("../fingerprint.ts");
    const currentFp = getMachineFingerprint();
    assert.match(currentFp, /^NVX-FP-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);

    // 1. 匹配当前指纹的 License -> 验证成功
    const matchedPayload = {
      licenseId: "NVL-FP-001",
      customer: "绑定指纹客户",
      email: "bound@example.com",
      plan: "pro_lifetime",
      features: ["all"],
      issuedAt: Date.now(),
      expiresAt: 0,
      fingerprint: currentFp,
    };
    const matchedToken = issueTestToken(matchedPayload);
    const matchedRes = verifyLicenseKey(matchedToken);
    assert.equal(matchedRes.valid, true, "指纹匹配时应当验证成功");

    // 2. 指纹不匹配的 License -> 验证失败
    const mismatchedPayload = {
      licenseId: "NVL-FP-002",
      customer: "不同机器客户",
      email: "other@example.com",
      plan: "pro_lifetime",
      features: ["all"],
      issuedAt: Date.now(),
      expiresAt: 0,
      fingerprint: "NVX-FP-9999-8888-7777-6666",
    };
    const mismatchedToken = issueTestToken(mismatchedPayload);
    const mismatchedRes = verifyLicenseKey(mismatchedToken);
    assert.equal(mismatchedRes.valid, false, "指纹不匹配时应当拒绝激活");
    assert.match(mismatchedRes.error || "", /仅限绑定的实例使用/);

    // 3. 通配符指纹 "*" 的 License -> 任意机器均可验证通过
    const wildcardPayload = {
      licenseId: "NVL-FP-003",
      customer: "企业通配客户",
      email: "corp@example.com",
      plan: "team_enterprise",
      features: ["all"],
      issuedAt: Date.now(),
      expiresAt: 0,
      fingerprint: "*",
    };
    const wildcardToken = issueTestToken(wildcardPayload);
    const wildcardRes = verifyLicenseKey(wildcardToken);
    assert.equal(wildcardRes.valid, true, "通配符指纹应当全局有效");
  });
});
