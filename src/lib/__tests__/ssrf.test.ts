import { describe, it } from "node:test";
import assert from "node:assert/strict";
import dnsPromises from "node:dns/promises";
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

// Use the real HTTP transport, without DNS or external network dependencies.
import http from "node:http";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";
import { performFetch, isLoopbackOrLinkLocalIP } from "../ssrf.ts";

async function withServer(handler: http.RequestListener, run: (port: number) => Promise<void>) {
  const server = http.createServer(handler);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try { await run((server.address() as AddressInfo).port); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}

describe("bounded pinned HTTP requests", () => {
  it("uses the validated socket address while preserving the original Host", async () => {
    await withServer((req, res) => res.end(req.headers.host), async port => {
      const response = await performFetch(`http://unresolvable.invalid:${port}/`, {}, 1000, ["127.0.0.1"]);
      assert.equal(await response.text(), `unresolvable.invalid:${port}`);
      assert.equal(response.url, `http://unresolvable.invalid:${port}/`);
    });
  });
  it("times out during body consumption after headers arrive", async () => {
    await withServer((_req, res) => { res.writeHead(200); res.flushHeaders(); }, async port => {
      await assert.rejects(performFetch(`http://127.0.0.1:${port}/`, {}, 40), /abort|timed out/i);
    });
  });
  it("honors caller cancellation during a stalled body", async () => {
    await withServer((_req, res) => { res.writeHead(200); res.flushHeaders(); }, async port => {
      const controller = new AbortController();
      const pending = performFetch(`http://127.0.0.1:${port}/`, { signal: controller.signal }, 5000);
      setTimeout(() => controller.abort(), 30);
      await assert.rejects(pending, /abort/i);
    });
  });
  it("bounds decoded body size, including compressed content", async () => {
    await withServer((_req, res) => {
      res.writeHead(200, { "content-encoding": "gzip" }); res.end(gzipSync("x".repeat(4096)));
    }, async port => {
      await assert.rejects(performFetch(`http://127.0.0.1:${port}/`, {}, 1000, ["127.0.0.1"], 1024), /RESPONSE_TOO_LARGE/);
      const response = await performFetch(`http://127.0.0.1:${port}/`, {}, 1000);
      assert.equal((await response.text()).length, 4096);
      assert.equal(response.headers.get("content-encoding"), null);
    });
  });
  it("normalizes expanded IPv6 and blocks all link-local spellings", () => {
    assert.equal(isPrivateIPv6("0:0:0:0:0:ffff:7f00:1"), true);
    assert.equal(isLoopbackOrLinkLocalIP("fe81::1"), true);
    assert.equal(isLoopbackOrLinkLocalIP("0:0:0:0:0:ffff:a9fe:a9fe"), true);
  });

  // 内网设备普遍以主机名配置（nas.local、router.internal），早期实现按域名后缀
  // 一律拒绝，导致 allowPrivateIPs 对真实内网地址形同虚设。准入判定改为依据
  // 解析出的 IP，因此这里按解析结果断言，而不是按域名后缀。
  describe("内网模式下的域名准入按解析结果判定", () => {
    it("放行解析到 RFC1918 的内网域名，仍拒绝解析到回环/链路本地的同名域名", async () => {
      const original = dnsPromises.lookup;
      const stub = (addresses: { address: string; family: number }[]) => {
        (dnsPromises as { lookup: unknown }).lookup = async () => addresses;
      };
      try {
        stub([{ address: "192.168.1.5", family: 4 }]);
        for (const host of ["nas.local", "router.internal", "nas.localhost"]) {
          assert.deepEqual(await validateHostIPs(host, { allowPrivateIPs: true }), ["192.168.1.5"]);
        }

        // 解析结果落在回环/链路本地时，域名后缀不再是拦截依据，IP 复查才是
        stub([{ address: "127.0.0.1", family: 4 }]);
        await assert.rejects(() => validateHostIPs("nas.local", { allowPrivateIPs: true }), /SSRF_BLOCKED/);
        stub([{ address: "169.254.169.254", family: 4 }]);
        await assert.rejects(() => validateHostIPs("nas.local", { allowPrivateIPs: true }), /SSRF_BLOCKED/);

        // 严格模式（默认）不受影响：内网域名仍按 IP 判为私有而拒绝
        stub([{ address: "192.168.1.5", family: 4 }]);
        await assert.rejects(() => validateHostIPs("nas.local"), /SSRF_BLOCKED/);
      } finally {
        (dnsPromises as { lookup: unknown }).lookup = original;
      }
    });
  });
});
