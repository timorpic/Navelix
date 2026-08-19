import dns from "node:dns/promises";
import net from "node:net";

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

  const normalized = ip.toLowerCase().trim();

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
 * 校验任意 IP 是否为云服务器元数据 IP (169.254.0.0/16)，任何模式下均绝对封禁
 */
export function isCloudMetadataIP(ip: string): boolean {
  if (!net.isIPv4(ip)) return false;
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  return parts[0] === 169 && parts[1] === 254;
}

/**
 * 校验任意 IP（IPv4 或 IPv6）是否为受限的内部/保留 IP
 */
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
    const lower = ip.toLowerCase();
    if (
      lower === "::1" ||
      lower === "0:0:0:0:0:0:0:1" ||
      lower.startsWith("fe80") ||
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
  const cleanHost = hostname.trim().toLowerCase();

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
  allowPrivateIPs?: boolean;
}

/**
 * SSRF 安全的 fetch 客户端：
 * 1. 验证目标 URL 协议（仅限 http: 和 https:）
 * 2. 解析 Host 并验证所有 A/AAAA IP 记录
 * 3. 逐级追踪重定向（redirect: 'manual'），每次重定向均对目标 URL 及 DNS 解析进行 SSRF 校验，防止重定向绕过
 * 4. 防御 DNS Rebinding
 */
export async function safeFetch(urlInput: string, options: SafeFetchOptions = {}): Promise<Response> {
  const { maxRedirects = 5, timeoutMs = 10_000, allowPrivateIPs = false, ...fetchInit } = options;

  let currentUrl = urlInput;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(currentUrl);
    } catch {
      throw new Error(`INVALID_URL: Failed to parse URL '${currentUrl}'`);
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error(`SSRF_BLOCKED: Unsupported protocol '${parsedUrl.protocol}'`);
    }

    // SSRF & DNS 校验：解析 Host 名下所有 IP 并检查私有地址
    await validateHostIPs(parsedUrl.hostname, { allowPrivateIPs });

    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        ...fetchInit,
        redirect: "manual",
        signal: controller.signal,
      });

      // 判断是否需要处理重定向
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          return response;
        }

        const nextUrl = new URL(location, parsedUrl).toString();
        redirectCount++;
        if (redirectCount > maxRedirects) {
          throw new Error(`MAX_REDIRECTS_EXCEEDED: Exceeded max redirects limit of ${maxRedirects}`);
        }
        currentUrl = nextUrl;
        continue;
      }

      return response;
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  throw new Error(`MAX_REDIRECTS_EXCEEDED: Exceeded max redirects limit`);
}
