import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createShareToken, verifyShareToken } from "../share.ts";

describe("Public Share Token HMAC Verification", () => {
  it("should create and verify valid share tokens", () => {
    const token = createShareToken("category", "cat-dev", "user-admin", 7);
    const result = verifyShareToken(token);

    assert.equal(result.valid, true);
    assert.equal(result.payload?.type, "category");
    assert.equal(result.payload?.id, "cat-dev");
    assert.equal(result.payload?.userId, "user-admin");
    assert(result.payload!.exp > Date.now());
  });

  it("should reject tampered tokens", () => {
    const token = createShareToken("category", "cat-dev", "user-admin", 7);
    const [payload, sig] = token.split(".");
    // Tamper payload
    const tampered = `tampered${payload}.${sig}`;
    const result = verifyShareToken(tampered);

    assert.equal(result.valid, false);
    assert.equal(result.error, "凭证签名校验失败或已被篡改");
  });

  it("should reject expired tokens", () => {
    // Expired (-1 day)
    const token = createShareToken("project", "proj-1", "user-admin", -1);
    const result = verifyShareToken(token);

    assert.equal(result.valid, false);
    assert.equal(result.error, "分享链接已过期");
  });

  it("should reject malformed tokens", () => {
    assert.equal(verifyShareToken("invalid").valid, false);
    assert.equal(verifyShareToken("").valid, false);
  });
});
