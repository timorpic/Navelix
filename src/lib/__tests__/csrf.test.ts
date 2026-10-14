import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkCSRF } from "../csrf.ts";

describe("CSRF Protection", () => {
  it("should allow request when origin matches host", () => {
    const req = new Request("http://example.com/api/projects", {
      method: "POST",
      headers: {
        host: "example.com",
        origin: "http://example.com",
      },
    });
    assert.equal(checkCSRF(req).success, true);
  });

  it("should reject request when origin does not match host", () => {
    const req = new Request("http://example.com/api/projects", {
      method: "POST",
      headers: {
        host: "example.com",
        origin: "http://attacker.com",
      },
    });
    assert.equal(checkCSRF(req).success, false);
  });

  it("should reject localhost origin when host is external domain", () => {
    const req = new Request("http://example.com/api/projects", {
      method: "POST",
      headers: {
        host: "example.com",
        origin: "http://localhost:3000",
      },
    });
    assert.equal(checkCSRF(req).success, false);
  });

  it("should allow localhost origin when host is also localhost", () => {
    const req = new Request("http://localhost:3721/api/projects", {
      method: "POST",
      headers: {
        host: "localhost:3721",
        origin: "http://localhost:3721",
      },
    });
    assert.equal(checkCSRF(req).success, true);
  });

  it("should allow request with Bearer authorization header without origin", () => {
    const req = new Request("http://example.com/api/notifications", {
      method: "POST",
      headers: {
        authorization: "Bearer nvx_live_123456",
      },
    });
    assert.equal(checkCSRF(req).success, true);
  });
});

describe("CSRF origin boundaries", () => {
  it("compares the entire normalized origin including scheme, port and IPv6", () => {
    for (const [url, host, origin, allowed] of [
      ["http://localhost:3721", "localhost:3721", "http://localhost:4000", false],
      ["http://localhost:3721", "localhost:3721", "http://127.0.0.1:3721", false],
      ["https://example.com", "example.com:443", "https://EXAMPLE.com", true],
      ["https://example.com", "example.com", "http://example.com", false],
      ["http://[::1]:3721", "[::1]:3721", "http://[::1]:3721", true],
      ["http://[::1]:3721", "[::1]:3721", "http://[::1]:4000", false],
    ] as const) {
      const req = new Request(url + "/api/user/data", { method: "POST", headers: { host, origin } });
      assert.equal(checkCSRF(req).success, allowed, `${host} vs ${origin}`);
    }
  });
  it("uses forwarded host and protocol only under explicit proxy trust", () => {
    const previous = process.env.TRUST_PROXY;
    try {
      const req = new Request("http://internal:3721", { method: "POST", headers: { host: "internal:3721", "x-forwarded-host": "public.example:443", "x-forwarded-proto": "https", origin: "https://public.example" } });
      process.env.TRUST_PROXY = "false";
      assert.equal(checkCSRF(req).success, false);
      process.env.TRUST_PROXY = "true";
      assert.equal(checkCSRF(req).success, true);
    } finally { if (previous === undefined) delete process.env.TRUST_PROXY; else process.env.TRUST_PROXY = previous; }
  });
});
