import { safeFetch } from "./ssrf.ts";

const MAX_PAGE_BYTES = 512 * 1024;
const MAX_ICON_BYTES = 1_000_000;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type FetchResource = (url: string) => Promise<Response>;
export interface WebsiteIcon { dataUrl: string; iconUrl: string }

function decodeAttribute(value: string): string {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
    const named: Record<string, string> = { "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">" };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const hex = entity.toLowerCase().startsWith("&#x");
    const code = Number.parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}
function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pattern = /([^\s=<>/'"]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(pattern)) {
    const key = match[1].toLowerCase();
    if (!(key in result)) result[key] = decodeAttribute(match[2] ?? match[3] ?? match[4]);
  }
  return result;
}
function httpUrl(value: string, base: URL): string | null {
  try {
    const url = new URL(value, base);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

/** Parse quoted and minified HTML attributes; resolve against the final page URL and optional base. */
export function resolveIconCandidates(html: string, pageUrl: URL): string[] {
  const markup = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const tags = markup.match(/<(?:link|base)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi) ?? [];
  const baseTag = tags.find(tag => /^<base\b/i.test(tag));
  const baseHref = baseTag ? attributes(baseTag).href : undefined;
  const base = baseHref ? new URL(httpUrl(baseHref, pageUrl) ?? pageUrl.href) : pageUrl;
  const urls: string[] = [];
  for (const tag of tags) {
    if (!/^<link\b/i.test(tag)) continue;
    const attrs = attributes(tag);
    const rel = attrs.rel?.toLowerCase().split(/\s+/) ?? [];
    if (!rel.some(value => ["icon", "apple-touch-icon", "apple-touch-icon-precomposed"].includes(value)) || !attrs.href) continue;
    const url = httpUrl(attrs.href, base);
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

async function readLimited(response: Response, limit: number, truncate = false): Promise<Buffer> {
  const length = Number(response.headers.get("content-length"));
  if (length > limit && !truncate) { await response.body?.cancel(); throw new Error("response too large"); }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("empty response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (size + value.byteLength > limit) {
        if (!truncate) throw new Error("response too large");
        chunks.push(value.subarray(0, limit - size));
        break;
      }
      size += value.byteLength;
      chunks.push(value);
    }
  } finally { await reader.cancel(); reader.releaseLock(); }
  return Buffer.concat(chunks);
}

/** Reject HTML/error pages even when the site responds with HTTP 200. */
export function iconContentType(bytes: Buffer, declared: string | null): string | null {
  if (bytes.length === 0) return null;
  const prefix = bytes.subarray(0, 1024).toString("utf8").trimStart();
  if (/^(?:<!doctype\s+html|<html\b|<head\b|<body\b)/i.test(prefix)) return null;
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (/^GIF8[79]a/.test(bytes.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (bytes.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))) return "image/x-icon";
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (/^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg\b/i.test(prefix)) return "image/svg+xml";
  const type = declared?.split(";")[0].trim().toLowerCase();
  return type && /^image\/(?:avif|bmp|vnd.microsoft.icon)$/.test(type) ? type : null;
}

const fetchResource: FetchResource = url => safeFetch(url, {
  timeoutMs: 8_000, allowPrivateIPs: false, headers: { "User-Agent": USER_AGENT },
});

export interface FetchWebsiteIconOptions {
  /**
   * 允许访问私有网段（RFC1918），用于抓取内网 NAS / 路由器等自建服务的图标。
   *
   * 与 AI 端点一致，即使开启本项也**始终**封禁回环与链路本地地址
   * （`127.0.0.0/8`、`::1`、`169.254.0.0/16` 云元数据），详见 `ssrf.ts`。
   */
  allowPrivateIPs?: boolean;
}

/**
 * 抓取网站图标。
 *
 * `fetcher` 省略时按 `options.allowPrivateIPs` 构造实际请求器 —— 每一跳
 * （首页、声明的图标、根 favicon、重定向）都重新经过 SSRF 校验，
 * 内网模式不会因为图标 URL 指向别的主机而放宽。
 */
export async function fetchWebsiteIcon(
  pageUrl: URL,
  fetcher?: FetchResource,
  options: FetchWebsiteIconOptions = {},
): Promise<WebsiteIcon | null> {
  const request = fetcher ?? (options.allowPrivateIPs === true
    ? (url: string) => safeFetch(url, { timeoutMs: 8_000, allowPrivateIPs: true, headers: { "User-Agent": USER_AGENT } })
    : fetchResource);

  let base = pageUrl;
  let candidates: string[] = [];
  try {
    const response = await request(pageUrl.href);
    if (response.ok) {
      base = new URL(response.url || pageUrl.href);
      const isImage = response.headers.get("content-type")?.toLowerCase().startsWith("image/") ?? false;
      const bytes = await readLimited(response, isImage ? MAX_ICON_BYTES : MAX_PAGE_BYTES, !isImage);
      const type = iconContentType(bytes, response.headers.get("content-type"));
      if (type) return { dataUrl: `data:${type};base64,${bytes.toString("base64")}`, iconUrl: base.href };
      candidates = resolveIconCandidates(bytes.toString("utf8"), base);
    } else { await response.body?.cancel(); }
  } catch { /* A missing homepage must not prevent trying its favicon. */ }
  candidates.push(new URL("/favicon.ico", base).href);
  candidates.push(
    `https://icons.duckduckgo.com/ip3/${base.hostname}.ico`,
    `https://api.iowen.cn/favicon/${base.hostname}.png`,
    `https://icon.horse/icon/${base.hostname}`,
  );
  for (const url of new Set(candidates)) {
    try {
      const response = await request(url);
      if (!response.ok) { await response.body?.cancel(); continue; }
      const bytes = await readLimited(response, MAX_ICON_BYTES);
      const type = iconContentType(bytes, response.headers.get("content-type"));
      if (type) return { dataUrl: `data:${type};base64,${bytes.toString("base64")}`, iconUrl: response.url || url };
    } catch { /* Try the next declared icon, then the root icon and public providers. */ }
  }
  return null;
}
