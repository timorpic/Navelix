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

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const hostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const host = hostHeader.split(":")[0];

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
      h === "localhost" || h === "127.0.0.1" || h === "::1";

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
