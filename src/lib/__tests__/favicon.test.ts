import { describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import { fetchWebsiteIcon, resolveIconCandidates, iconContentType } from "../favicon.ts";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64");
const page = new URL("https://www.timor.eu.org/");
function image() { return new Response(png, { headers: { "content-type": "image/png" } }); }

describe("website favicon discovery", () => {
  it("recognizes the minified unquoted declaration used by timor.eu.org", async () => {
    const requested: string[] = [];
    const icon = await fetchWebsiteIcon(page, async url => {
      requested.push(url);
      return url === page.href ? new Response("<link rel=icon href=assets/logo_shuwei_zhiyu.png type=image/png>") : image();
    });
    assert.equal(icon?.iconUrl, "https://www.timor.eu.org/assets/logo_shuwei_zhiyu.png");
    assert.equal(icon?.dataUrl, `data:image/png;base64,${png.toString("base64")}`);
    assert.deepEqual(requested, [page.href, icon?.iconUrl]);
  });
  it("handles attribute order, rel tokens, base URLs and HTML entities without matching comments or scripts", () => {
    const html = `<base href='/assets/'><link HREF="icon.png?a=1&amp;b=2" REL='shortcut ICON'>
      <link rel=apple-touch-icon href=touch.png><link rel=stylesheet href=wrong.css>
      <!-- <link rel=icon href=comment.png> --><script>"<link rel=icon href=script.png>"</script>
      <link rel=icon href='javascript:alert(1)'>`;
    assert.deepEqual(resolveIconCandidates(html, page), ["https://www.timor.eu.org/assets/icon.png?a=1&b=2", "https://www.timor.eu.org/assets/touch.png"]);
  });
  it("resolves relative icons against the final redirected page URL", async () => {
    const redirected = new Response("<link rel=icon href=icon.png>");
    Object.defineProperty(redirected, "url", { value: "https://cdn.example.com/site/index.html" });
    const icon = await fetchWebsiteIcon(page, async url => url === page.href ? redirected : image());
    assert.equal(icon?.iconUrl, "https://cdn.example.com/site/icon.png");
  });
  it("tries the next declaration when the first returns an HTML fallback page", async () => {
    const requested: string[] = [];
    const icon = await fetchWebsiteIcon(page, async url => {
      requested.push(url);
      if (url === page.href) return new Response('<link rel=icon href="/missing.ico"><link rel=icon href="/real.png">');
      return url.endsWith("real.png") ? image() : new Response("<!DOCTYPE html><html>fallback</html>", { headers: { "content-type": "text/html" } });
    });
    assert.equal(icon?.iconUrl, "https://www.timor.eu.org/real.png");
    assert.equal(requested.length, 3);
  });
  it("rejects HTTP 200 HTML at /favicon.ico and does not report an unusable URL as success", async () => {
    const icon = await fetchWebsiteIcon(page, async () => new Response("<!DOCTYPE html><html>fallback</html>", { headers: { "content-type": "text/html" } }));
    assert.equal(icon, null);
    assert.equal(iconContentType(Buffer.from("<!DOCTYPE html><html>error</html>"), "image/png"), null);
    assert.equal(iconContentType(Buffer.alloc(0), "image/png"), null);
    assert.equal(iconContentType(png, "application/octet-stream"), "image/png");
  });
  it("reads icon declarations from the head of a large HTML page without downloading the whole page", async () => {
    const html = '<link rel=icon href="/real.png">' + " ".repeat(600_000);
    const icon = await fetchWebsiteIcon(page, async url => url === page.href ? new Response(html) : image());
    assert.equal(icon?.iconUrl, "https://www.timor.eu.org/real.png");
  });
  it("rejects oversized responses and continues to a valid candidate", async () => {
    const icon = await fetchWebsiteIcon(page, async url => {
      if (url === page.href) return new Response('<link rel=icon href="/large.png"><link rel=icon href="/valid.png">');
      return url.endsWith("large.png") ? new Response(new Uint8Array(1_000_001), { headers: { "content-type": "image/png" } }) : image();
    });
    assert.equal(icon?.iconUrl, "https://www.timor.eu.org/valid.png");
  });
});

/**
 * 内网图标的准入由 `allowPrivateIPs` 控制（`/api/favicon` 按内网可用传入 true）。
 * 这里用本机真实网卡上的 RFC1918 地址起一个 HTTP 服务，验证两种模式的实际
 * 网络可达性 —— 不是断言选项被传递，而是断言请求真的发出（或真的被拦）。
 */
describe("intranet favicon access follows allowPrivateIPs", () => {
  /** 返回本机一个 RFC1918 地址；没有则返回 null，用例跳过。 */
  function privateIPv4(): string | null {
    for (const entries of Object.values(os.networkInterfaces())) {
      for (const entry of entries ?? []) {
        if (entry.family === "IPv4" && !entry.internal &&
            /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(entry.address)) {
          return entry.address;
        }
      }
    }
    return null;
  }

  it("reaches a private host when allowed and blocks it by default", async (t) => {
    const host = privateIPv4();
    if (!host) { t.skip("本机没有 RFC1918 地址，跳过"); return; }
    let hits = 0;
    const server = http.createServer((_req, res) => {
      hits++;
      res.writeHead(200, { "content-type": "image/png" });
      res.end(png);
    });
    await new Promise<void>(resolve => server.listen(0, "0.0.0.0", resolve));
    const { port } = server.address() as { port: number };
    const target = new URL(`http://${host}:${port}/`);
    try {
      // 严格模式（默认）：拒绝，且请求根本没发出去
      assert.equal(await fetchWebsiteIcon(target, undefined, { allowPrivateIPs: false }), null);
      assert.equal(hits, 0, "严格模式不应发出任何请求");

      // 允许内网：真实取到图标
      const icon = await fetchWebsiteIcon(target, undefined, { allowPrivateIPs: true });
      assert.ok(icon, "允许内网时应取到图标");
      assert.equal(icon.dataUrl, `data:image/png;base64,${png.toString("base64")}`);
      assert.equal(hits, 1);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  it("still blocks loopback and link-local even when private IPs are allowed", async () => {
    const server = http.createServer((_req, res) => { res.writeHead(200, { "content-type": "image/png" }); res.end(png); });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as { port: number };
    try {
      assert.equal(await fetchWebsiteIcon(new URL(`http://127.0.0.1:${port}/`), undefined, { allowPrivateIPs: true }), null);
      assert.equal(await fetchWebsiteIcon(new URL("http://169.254.169.254/"), undefined, { allowPrivateIPs: true }), null);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
