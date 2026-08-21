// 从 Request 头解析客户端 ID（用于登录限流维度）。
// 遵循 TRUST_PROXY 环境变量：开启时信任 X-Forwarded-For/X-Real-IP（反代场景），
// 未开启时仅兜底尝试 x-real-ip，避免被伪造头绕过。
export function getClientId(req: Request): string {
  const trustProxy =
    process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1";
  if (trustProxy) {
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();
  }
  // 未开 TRUST_PROXY 时回退尝试 x-real-ip（部分宿主/反代会显式注入），
  // 兜底为全局桶；登录路由会叠加用户名作为二级 key，避免全局锁死。
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "direct-client";
}
