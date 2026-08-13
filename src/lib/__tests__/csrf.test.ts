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
});
