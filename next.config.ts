import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // 全站默认 CSP：允许自身资源 + 用户自定义的 http(s) 图标/头像/Logo
  // 说明：script-src 含 'unsafe-inline' 以兼容 Next.js App Router 的 inline scripts；
  //       如需进一步收紧，可在统计出生产环境的 nonce 方案后移除。
  //       connect-src 仅允许同源（前端所有 API 调用均走 /api/* 代理），
  //       外部 AI/天气/图标等服务全部由服务端 safeFetch 代理，浏览器不直连。
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  // 运行期数据目录（SQLite 库、备份、初始密码）不得被追踪进 standalone 镜像：
  // 否则构建时 worker 生成的含随机 admin 密码的 dev DB 会被烘焙进 Docker 镜像，
  // 导致冒烟测试的 NAVELIX_ADMIN_PASSWORD 登录校验失败。
  // 种子数据源在 src/data/links.ts（由模块打包正常引入），不受此排除影响。
  outputFileTracingExcludes: {
    "/*": ["./data/**"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "www.google.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;