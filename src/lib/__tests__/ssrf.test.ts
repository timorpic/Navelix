import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isPrivateIPv4,
  isPrivateIPv6,
  validateHostIPs,
  safeFetch,
} from "../ssrf.ts";

describe("SSRF Security Protection", () => {
  it("should correctly detect private IPv4 addresses", () => {
    assert.equal(isPrivateIPv4("127.0.0.1"), true);
    assert.equal(isPrivateIPv4("127.255.255.255"), true);
    assert.equal(isPrivateIPv4("10.0.0.1"), true);
    assert.equal(isPrivateIPv4("10.255.255.255"), true);
    assert.equal(isPrivateIPv4("172.16.0.1"), true);
    assert.equal(isPrivateIPv4("172.31.255.255"), true);
    assert.equal(isPrivateIPv4("192.168.1.1"), true);
    assert.equal(isPrivateIPv4("169.254.169.254"), true);
    assert.equal(isPrivateIPv4("0.0.0.0"), true);
    assert.equal(isPrivateIPv4("100.64.0.1"), true);

    // Public IPv4 addresses
    assert.equal(isPrivateIPv4("8.8.8.8"), false);
    assert.equal(isPrivateIPv4("1.1.1.1"), false);
    assert.equal(isPrivateIPv4("140.82.121.4"), false);
  });

  it("should correctly detect private IPv6 addresses", () => {
    assert.equal(isPrivateIPv6("::1"), true);
    assert.equal(isPrivateIPv6("::"), true);
    assert.equal(isPrivateIPv6("fe80::1"), true);
    assert.equal(isPrivateIPv6("fc00::1"), true);
    assert.equal(isPrivateIPv6("fd12:3456:789a:1::1"), true);
    assert.equal(isPrivateIPv6("::ffff:127.0.0.1"), true);
    assert.equal(isPrivateIPv6("::ffff:10.0.0.1"), true);

    // Public IPv6
    assert.equal(isPrivateIPv6("2001:4860:4860::8888"), false);
  });

  it("should reject private IPs in validateHostIPs by default", async () => {
    await assert.rejects(() => validateHostIPs("127.0.0.1"), /SSRF_BLOCKED/);
    await assert.rejects(() => validateHostIPs("localhost"), /SSRF_BLOCKED/);
    await assert.rejects(() => validateHostIPs("169.254.169.254"), /SSRF_BLOCKED/);
    await assert.rejects(() => validateHostIPs("10.0.0.1"), /SSRF_BLOCKED/);
  });

  it("should allow private IPs when allowPrivateIPs is true, but block cloud metadata IP", async () => {
    const ips = await validateHostIPs("192.168.1.1", { allowPrivateIPs: true });
    assert.deepEqual(ips, ["192.168.1.1"]);

    await assert.rejects(
      () => validateHostIPs("169.254.169.254", { allowPrivateIPs: true }),
      /SSRF_BLOCKED/,
    );
  });

  it("should reject unsafe protocols in safeFetch", async () => {
    await assert.rejects(() => safeFetch("file:///etc/passwd"), /SSRF_BLOCKED/);
    await assert.rejects(() => safeFetch("gopher://127.0.0.1:70"), /SSRF_BLOCKED/);
    await assert.rejects(() => safeFetch("ftp://example.com/file"), /SSRF_BLOCKED/);
  });
});
