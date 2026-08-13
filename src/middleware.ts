import { NextResponse, type NextRequest } from "next/server";
import { checkCSRF } from "@/lib/csrf";

export function middleware(req: NextRequest) {
  const method = req.method.toUpperCase();

  // 对所有 API 的写操作（POST / PUT / PATCH / DELETE）强制进行 CSRF / Origin 校验
  if (req.nextUrl.pathname.startsWith("/api/")) {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      const res = checkCSRF(req);
      if (!res.success) {
        return NextResponse.json(
          { error: res.error || "CSRF 验证失败：跨域请求被拒绝" },
          { status: res.status || 403 },
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
