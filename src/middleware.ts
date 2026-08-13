import { NextResponse, type NextRequest } from "next/server";
import { checkCSRF } from "@/lib/csrf";

/**
 * 向 NextResponse 注入安全响应头。
 * 注意：此 middleware 仅覆盖 /api/* 路径（由 matcher 控制）。
 * 页面级安全头已在 next.config.ts 的 headers() 中全局配置。
 */
function applySecurityHeaders(res: NextResponse): NextResponse {
  // X-Frame-Options: 禁止页面被嵌入 iframe（配合 frame-ancestors 'none' CSP）
  res.headers.set("X-Frame-Options", "DENY");
  // X-Content-Type-Options: 禁止 MIME 嗅探
  res.headers.set("X-Content-Type-Options", "nosniff");
  // Referrer-Policy: 同源完整 URL，跨源仅来源
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Permissions-Policy: 限制浏览器 API 权限
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );
  // 在 HTTPS 环境下设置 HSTS
  // 注意：HTTP 部署时浏览器会忽略此头，安全
  if (process.env.NAVELIX_COOKIE_SECURE === "true") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=15552000; includeSubDomains",
    );
  }

  return res;
}

export function middleware(req: NextRequest) {
  const method = req.method.toUpperCase();

  // 对所有 API 的写操作（POST / PUT / PATCH / DELETE）强制进行 CSRF / Origin 校验
  if (req.nextUrl.pathname.startsWith("/api/")) {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const res = checkCSRF(req);
      if (!res.success) {
        return applySecurityHeaders(
          NextResponse.json(
            { error: res.error || "CSRF 验证失败：跨域请求被拒绝" },
            { status: res.status || 403 },
          ),
        );
      }
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: "/api/:path*",
};