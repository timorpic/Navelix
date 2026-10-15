import dns from "node:dns/promises";
import net from "node:net";
import http from "node:http";
import https from "node:https";
import { createBrotliDecompress, createGunzip, createInflate } from "node:zlib";

/**
 * 判断 IPv4 地址是否在私有或保留地址段中
 */
export function isPrivateIPv4(ip: string): boolean {
  if (!net.isIPv4(ip)) return false;

  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true;
  }

  const [p0, p1] = parts;

  // 0.0.0.0/8 (Current network)
  if (p0 === 0) return true;
  // 10.0.0.0/8 (Private IP)
  if (p0 === 10) return true;
  // 100.64.0.0/10 (Carrier-grade NAT)
  if (p0 === 100 && p1 >= 64 && p1 <= 127) return true;
  // 127.0.0.0/8 (Loopback)
  if (p0 === 127) return true;
  // 169.254.0.0/16 (Link-local / APIPA / Cloud Metadata 169.254.169.254)
  if (p0 === 169 && p1 === 254) return true;
  // 172.16.0.0/12 (Private IP)
  if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;
  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (p0 === 192 && p1 === 0) return true;
  // 192.0.2.0/24 (TEST-NET-1)
  if (p0 === 192 && p1 === 0 && parts[2] === 2) return true;
  // 192.168.0.0/16 (Private IP)
  if (p0 === 192 && p1 === 168) return true;
  if (p0 === 198 && (p1 === 18 || p1 === 19)) return true;
  // 198.51.100.0/24 (TEST-NET-2)
  if (p0 === 198 && p1 === 51 && parts[2] === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (p0 === 203 && p1 === 0 && parts[2] === 113) return true;
  // 224.0.0.0/4 (Multicast)
  if (p0 >= 224 && p0 <= 239) return true;
  // 240.0.0.0/4 (Reserved / Broadcast)
  if (p0 >= 240) return true;

  return false;
}

/**
 * 判断 IPv6 地址是否在私有、回环或保留地址段中
 */
export function isPrivateIPv6(ip: string): boolean {
  if (!net.isIPv6(ip)) return false;

  const normalized = new URL(`http://[${ip}]/`).hostname.slice(1, -1);

  // 回环与未指定地址 ::1 / ::
  if (normalized === "::1" || normalized === "::" || normalized === "0:0:0:0:0:0:0:1" || normalized === "0:0:0:0:0:0:0:0") {
    return true;
  }

  // IPv4-mapped IPv6 地址 (::ffff:x.x.x.x 或 ::ffff:7f00:1 等)
  if (normalized.startsWith("::ffff:")) {
    const v4Part = normalized.slice(7);
    if (net.isIPv4(v4Part)) {
      return isPrivateIPv4(v4Part);
    }
    // 可能是 hex 格式 ::ffff:7f00:1
    const hexParts = v4Part.split(":");
    if (hexParts.length === 2) {
      const p1 = parseInt(hexParts[0], 16);
      const p2 = parseInt(hexParts[1], 16);
      if (!isNaN(p1) && !isNaN(p2)) {
        const ipv4Str = `${(p1 >> 8) & 0xff}.${p1 & 0xff}.${(p2 >> 8) & 0xff}.${p2 & 0xff}`;
        return isPrivateIPv4(ipv4Str);
      }
    }
    return true;
  }

  // Unique Local Addresses (fc00::/7 - fc00:: 至 fdff::)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }

  // Link-Local Addresses (fe80::/10 - fe80:: 至 febf::)
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true;
  }

  // Multicast (ff00::/8)
  if (normalized.startsWith("ff")) {
    return true;
  }

  return false;
}

/**
 * 回环地址与链路本地一律恒定拦截：
 * 回环可探针宿主机本机服务（如反代端口、容器管理面），
 * 链路本地 169.254/16 含云元数据凭据窃取面。
 * 无论是否开启 allowPrivateIPs 都执行此检查。
 */
export function isLoopbackOrLinkLocalIP(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p0 = parseInt(ip.split(".")[0], 10);
    return p0 === 127 || p0 === 169;
  }
  if (net.isIPv6(ip)) {
    const lower = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
    if (
      lower === "::1" ||
      lower === "0:0:0:0:0:0:0:1" ||
      lower.startsWith("fe8") ||
      lower.startsWith("fe9") ||
      lower.startsWith("fea") ||
      lower.startsWith("feb")
    ) {
      return true;
    }
    if (lower.startsWith("::ffff:")) {
      const v4Part = lower.slice(7);
      if (net.isIPv4(v4Part)) return isLoopbackOrLinkLocalIP(v4Part);
      const hexParts = v4Part.split(":");
      if (hexParts.length === 2) {
        const p1 = parseInt(hexParts[0], 16);
        const p2 = parseInt(hexParts[1], 16);
        if (!isNaN(p1) && !isNaN(p2)) {
          const ipv4Str = `${(p1 >> 8) & 0xff}.${p1 & 0xff}.${(p2 >> 8) & 0xff}.${p2 & 0xff}`;
          return isLoopbackOrLinkLocalIP(ipv4Str);
        }
      }
    }
  }
  return false;
}

/** 校验任意 IP（IPv4 或 IPv6）是否为受限的内部/保留 IP */
export function isPrivateOrReservedIP(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  // 无法识别为合法 IP 地址，出于安全考虑拒绝
  return true;
}

export interface ValidateHostOptions {
  allowPrivateIPs?: boolean;
}

/**
 * 检查域名解析出的所有 IP，确保不包含受限 IP（可选项：allowPrivateIPs 用于允许导航站内网设备抓取图标/探测状态）
 */
export async function validateHostIPs(hostname: string, options: ValidateHostOptions = {}): Promise<string[]> {
  const { allowPrivateIPs = false } = options;
  const cleanHost = hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");

  // 1. 如果配置了允许内网 IP（导航站抓取内网 NAS/路由器/开发服务）
if (allowPrivateIPs) {
    // 绝对封禁：回环地址与链路本地（含云元数据）——不论内网模式是否开启
    if (
      cleanHost === "localhost" ||
      cleanHost.endsWith(".localhost") ||
      cleanHost.endsWith(".local") ||
      cleanHost.endsWith(".internal")
    ) {
      throw new Error(`SSRF_BLOCKED: Host '${hostname}' is an internal domain name`);
    }
    if (net.isIP(cleanHost) && isLoopbackOrLinkLocalIP(cleanHost)) {
      throw new Error(`SSRF_BLOCKED: IP '${cleanHost}' is loopback/link-local and forbidden`);
    }

    if (net.isIP(cleanHost)) {
      return [cleanHost];
    }

    let addresses: { address: string; family: number }[] = [];
    try {
      addresses = await dns.lookup(cleanHost, { all: true });
    } catch (err) {
      throw new Error(`DNS_LOOKUP_FAILED: Failed to resolve hostname '${hostname}': ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!addresses || addresses.length === 0) {
      throw new Error(`DNS_LOOKUP_FAILED: No IP addresses found for hostname '${hostname}'`);
    }

    for (const { address } of addresses) {
      if (isLoopbackOrLinkLocalIP(address)) {
        throw new Error(`SSRF_BLOCKED: Hostname '${hostname}' resolved to loopback/link-local IP '${address}'`);
      }
    }
    return addresses.map((a) => a.address);
  }

  // 2. 默认模式：严格禁止一切内网、回环及私有 IP
  if (
    cleanHost === "localhost" ||
    cleanHost.endsWith(".localhost") ||
    cleanHost.endsWith(".local") ||
    cleanHost.endsWith(".internal")
  ) {
    throw new Error(`SSRF_BLOCKED: Host '${hostname}' is an internal domain name`);
  }

  // 如果 Host 本身就是 IP 地址
  if (net.isIP(cleanHost)) {
    if (isPrivateOrReservedIP(cleanHost)) {
      throw new Error(`SSRF_BLOCKED: IP '${cleanHost}' is a private/reserved address`);
    }
    return [cleanHost];
  }

  // 执行 DNS 查询，获取所有 IPv4 及 IPv6 地址
  let addresses: { address: string; family: number }[] = [];
  try {
    addresses = await dns.lookup(cleanHost, { all: true });
  } catch (err) {
    throw new Error(`DNS_LOOKUP_FAILED: Failed to resolve hostname '${hostname}': ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new Error(`DNS_LOOKUP_FAILED: No IP addresses found for hostname '${hostname}'`);
  }

  const isIPLiteral = net.isIP(cleanHost) !== 0;

  const validIPs: string[] = [];
  for (const { address } of addresses) {
    // 防火墙/代理软件（如 Clash/V2Ray/Surge TUN 模式）产生的假 IP 假 DNS 映射，非真正的内网攻击
    const isSyntheticTun =
      !isIPLiteral &&
      (address.toLowerCase().startsWith("fdfe:dcba:9876") ||
        address.startsWith("198.18.") ||
        address.startsWith("198.19."));

    if (!isSyntheticTun && isPrivateOrReservedIP(address)) {
      throw new Error(`SSRF_BLOCKED: Hostname '${hostname}' resolved to private/reserved IP '${address}'`);
    }
    validIPs.push(address);
  }

  return validIPs;
}

export interface SafeFetchOptions extends RequestInit {
  maxRedirects?: number;
  timeoutMs?: number;
  maxResponseBytes?: number;
  allowPrivateIPs?: boolean;
}

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);

/**
 * 校验 URL 合法性并返回解析结果。
 * 仅允许 http: / https: 协议，其余协议一律拒绝（file / gopher / ftp 等）。
 */
export function validateUrl(urlInput: string): URL {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlInput);
  } catch {
    throw new Error(`INVALID_URL: Failed to parse URL '${urlInput}'`);
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error(`SSRF_BLOCKED: Unsupported protocol '${parsedUrl.protocol}'`);
  }
  return parsedUrl;
}

/**
 * 解析重定向响应，返回下一个目标 URL。
 * 无 Location 头时返回 null（直接返回原响应）。
 */
export function resolveRedirect(
  response: Response,
  baseUrl: URL,
): string | null {
  const location = response.headers.get("location");
  if (!location) return null;
  return new URL(location, baseUrl).toString();
}

/** Abort an outstanding DNS lookup without keeping a request waiting for it. */
async function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let onAbort: () => void = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try { return await Promise.race([work, interrupted]); }
  finally { signal.removeEventListener("abort", onAbort); }
}

/** A bounded buffered response: deadline covers DNS, headers AND decoded body. */
export async function performFetch(
  currentUrl: string,
  fetchInit: RequestInit,
  timeoutMs: number,
  validatedIPs?: string[],
  maxResponseBytes = 2 * 1024 * 1024,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
  const signal = fetchInit.signal ? AbortSignal.any([controller.signal, fetchInit.signal]) : controller.signal;
  try {
    const url = validateUrl(currentUrl);
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = validatedIPs ?? (await abortable(dns.lookup(hostname, { all: true }), signal)).map(row => row.address);
    if (!addresses.length) throw new Error("DNS_LOOKUP_FAILED");
    const request = new Request(url, { ...fetchInit, signal });
    const headers = Object.fromEntries(request.headers);
    // Host and TLS SNI come from the original URL; only the socket address is pinned.
    delete headers.host;
    delete headers["content-length"];
    headers["accept-encoding"] = "identity";
    const body = request.body ? Buffer.from(await abortable(request.arrayBuffer(), signal)) : undefined;
    signal.throwIfAborted();
    return await new Promise<Response>((resolve, reject) => {
      const transport = url.protocol === "https:" ? https : http;
      const req = transport.request(url, {
        method: request.method, headers, signal,
        lookup: (_hostname, options, callback) => {
          const candidates = addresses.filter(ip => !options.family || net.isIP(ip) === options.family);
          if (!candidates.length) { callback(new Error("DNS_LOOKUP_FAILED: no validated address"), "", 0); return; }
          if (options.all) callback(null, candidates.map(address => ({ address, family: net.isIP(address) })));
          else callback(null, candidates[0], net.isIP(candidates[0]));
        },
      }, res => {
        const encoding = res.headers["content-encoding"];
        const decoder = encoding === "gzip" ? createGunzip() : encoding === "deflate" ? createInflate() : encoding === "br" ? createBrotliDecompress() : null;
        const stream = decoder ? res.pipe(decoder) : res;
        const chunks: Buffer[] = [];
        let size = 0;
        const fail = (error: Error) => { res.destroy(); stream.destroy(); req.destroy(); reject(signal.aborted ? signal.reason : error); };
        res.on("aborted", () => fail(new Error("Response body interrupted")));
        res.on("error", fail);
        if (decoder) decoder.on("error", fail);
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxResponseBytes) { fail(new Error("RESPONSE_TOO_LARGE")); return; }
          chunks.push(chunk);
        });
        stream.on("end", () => {
          const responseHeaders = new Headers();
          for (const [key, value] of Object.entries(res.headers)) {
            if (value !== undefined) for (const entry of Array.isArray(value) ? value : [value]) responseHeaders.append(key, entry);
          }
          if (decoder) { responseHeaders.delete("content-encoding"); responseHeaders.delete("content-length"); }
          try {
            const status = res.statusCode ?? 502;
            const response = new Response(request.method === "HEAD" || [204, 205, 304].includes(status) ? null : Buffer.concat(chunks), {
              status, statusText: res.statusMessage, headers: responseHeaders,
            });
            Object.defineProperty(response, "url", { value: url.href });
            resolve(response);
          } catch (error) { reject(error); }
        });
      });
      req.on("error", reject);
      req.end(body);
    });
  } finally { clearTimeout(timer); }
}

/** Every redirect uses the validated socket addresses and the same total deadline. */
export async function safeFetch(urlInput: string, options: SafeFetchOptions = {}): Promise<Response> {
  const { maxRedirects = 5, timeoutMs = 10_000, maxResponseBytes = 2 * 1024 * 1024, allowPrivateIPs = false, ...initial } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
  const signal = initial.signal ? AbortSignal.any([controller.signal, initial.signal]) : controller.signal;
  let currentUrl = urlInput;
  let fetchInit = { ...initial, signal };
  try {
    for (let count = 0; count <= maxRedirects; count++) {
      const parsed = validateUrl(currentUrl);
      const addresses = await abortable(validateHostIPs(parsed.hostname, { allowPrivateIPs }), signal);
      const response = await performFetch(currentUrl, fetchInit, timeoutMs, addresses, maxResponseBytes);
      if (!REDIRECT_STATUS_CODES.has(response.status)) return response;
      const nextUrl = resolveRedirect(response, parsed);
      if (!nextUrl) return response;
      if (count === maxRedirects) throw new Error("MAX_REDIRECTS_EXCEEDED");
      const headers = new Headers(fetchInit.headers);
      if (new URL(nextUrl).origin !== parsed.origin) {
        headers.delete("authorization"); headers.delete("cookie"); headers.delete("proxy-authorization");
      }
      const method = (fetchInit.method || "GET").toUpperCase();
      if ((response.status === 303 && method !== "HEAD") || ([301, 302].includes(response.status) && method === "POST")) {
        fetchInit = { ...fetchInit, method: "GET", body: undefined };
        headers.delete("content-type"); headers.delete("content-length");
      }
      fetchInit = { ...fetchInit, headers };
      currentUrl = nextUrl;
    }
    throw new Error("MAX_REDIRECTS_EXCEEDED");
  } finally { clearTimeout(timer); }
}
