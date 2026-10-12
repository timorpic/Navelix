import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
