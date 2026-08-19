export interface CSRFCheckResult {
  success: boolean;
  status?: number;
  error?: string;
}

/**
 * 校验 POST / PUT / PATCH / DELETE 请求的 CSRF 同源策略 (Origin / Referer vs Host)
 */
export function checkCSRF(req: Request): CSRFCheckResult {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return { success: true };
  }

  // API Token (Authorization: Bearer nvx_live_...) 请求免除浏览器 CSRF 检查
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return { success: true };
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  // 仅在信任反向代理时才采用 X-Forwarded-Host，否则可能被伪造头绕过同源校验
  const trustProxy =
    process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1";
  const rawHost = (trustProxy ? req.headers.get("x-forwarded-host") : null) || req.headers.get("host") || "";
  const host = rawHost.includes("[")
    ? rawHost.match(/^\[([^\]]+)\]/)?.[1] || rawHost
    : rawHost.split(":")[0];

  const targetUrlStr = origin || referer;
  if (!targetUrlStr) {
    // 缺失 Origin 和 Referer 头的写请求拒绝
    return {
      success: false,
      status: 403,
      error: "CSRF check failed: missing Origin/Referer header",
    };
  }

  try {
    const targetUrl = new URL(targetUrlStr);
    const targetHost = targetUrl.hostname;

    const isLocalHost = (h: string) =>
      h === "localhost" || h === "::1" || h.startsWith("127.");

    if (targetHost && host) {
      if (isLocalHost(targetHost) && isLocalHost(host)) {
        return { success: true };
      }

      if (targetHost.toLowerCase() === host.toLowerCase()) {
        return { success: true };
      }
    }
  } catch {
    // 无效 URL
  }

  return {
    success: false,
    status: 403,
    error: "CSRF check failed: origin/host mismatch",
  };
}
