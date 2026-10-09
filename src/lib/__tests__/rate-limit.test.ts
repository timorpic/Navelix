import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getClientId, checkLoginRateLimit, recordLoginFailure, resetLoginRateLimit } from "../auth.ts";

describe("Login Rate Limit & Proxy IP Trust Protection", () => {
  it("should NOT trust X-Forwarded-For by default when TRUST_PROXY is not set", () => {
    delete process.env.TRUST_PROXY;

    const req1 = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "1.1.1.1" },
    });
    const req2 = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "2.2.2.2" },
    });

    // Both requests return the same fallback client ID "direct-client"
    assert.equal(getClientId(req1), "direct-client");
    assert.equal(getClientId(req2), "direct-client");
  });

  it("should NOT trust X-Real-IP by default when TRUST_PROXY is not set", () => {
    delete process.env.TRUST_PROXY;

    const req1 = new Request("http://localhost/api/auth/login", {
      headers: { "x-real-ip": "1.1.1.1" },
    });
    const req2 = new Request("http://localhost/api/auth/login", {
      headers: { "x-real-ip": "2.2.2.2" },
    });

    // 伪造 X-Real-IP 不能换来新的限流桶，否则爆破锁定与失败告警都会被绕过
    assert.equal(getClientId(req1), "direct-client");
    assert.equal(getClientId(req2), "direct-client");
  });

  it("should trust X-Real-IP when TRUST_PROXY=true", () => {
    process.env.TRUST_PROXY = "true";

    const req = new Request("http://localhost/api/auth/login", {
      headers: { "x-real-ip": "10.0.0.7" },
    });

    assert.equal(getClientId(req), "10.0.0.7");

    delete process.env.TRUST_PROXY;
  });

  it("should trust X-Forwarded-For when TRUST_PROXY=true", () => {
    process.env.TRUST_PROXY = "true";

    const req1 = new Request("http://localhost/api/auth/login", {
      headers: { "x-forwarded-for": "10.0.0.5, 192.168.1.1" },
    });

    assert.equal(getClientId(req1), "10.0.0.5");

    delete process.env.TRUST_PROXY;
  });

  it("should block after 5 failed login attempts for the same client ID", () => {
    const testClientId = "test-client-rate-limit-check";
    resetLoginRateLimit(testClientId);

    for (let i = 0; i < 5; i++) {
      const status = checkLoginRateLimit(testClientId);
      assert.equal(status.allowed, true);
      recordLoginFailure(testClientId);
    }

    const blockedStatus = checkLoginRateLimit(testClientId);
    assert.equal(blockedStatus.allowed, false);
    // 锁定时应返回正数剩余毫秒数
    assert.ok(blockedStatus.lockRemainingMs > 0, "lockRemainingMs should be > 0 when locked");

    resetLoginRateLimit(testClientId);
  });
});
