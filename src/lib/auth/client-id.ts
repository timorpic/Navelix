// 从 Request 头解析客户端 ID（用于登录限流维度与会话 IP 记录）。
// 遵循 TRUST_PROXY 环境变量：仅当显式声明信任反向代理时，才采信
// X-Forwarded-For / X-Real-IP；未声明时一律使用常量桶。
//
// 注意：这两个头都是客户端可自由伪造的。若在未开 TRUST_PROXY 时采信它们，
// 攻击者每次请求换一个值即可获得全新的限流桶，使登录锁定与失败告警同时失效。
// 未声明信任代理时退化为常量 "direct-client"，登录路由会再叠加用户名作为
// 二级 key（见 api/auth/login/route.ts），因此按账号的锁定依然有效。
export function getClientId(req: Request): string {
  const trustProxy =
    process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1";
  if (trustProxy) {
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  }
  return "direct-client";
}
