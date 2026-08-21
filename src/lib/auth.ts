// 聚合入口：保持外部导入路径 @/lib/auth 与 ./auth.ts 的公开 API 不变。
// 内部职责拆分至 ./auth/ 子目录：
// - session.ts           会话 CRUD + 鉴权 (createSession / destroySession / getSessionUser / toPublicUser / hashToken)
// - cookie.ts            会话 Cookie 配置 (sessionCookieOptions / clearSessionCookieOptions)
// - client-id.ts         客户端 IP/ID 解析 (getClientId)
// - login-rate-limit.ts  登录失败限流 (checkLoginRateLimit / recordLoginFailure / resetLoginRateLimit)
export { hashPassword, verifyPassword } from "./password.ts";
export { checkCSRF } from "./csrf.ts";
export {
  toPublicUser,
  createSession,
  destroySession,
  getSessionUser,
} from "./auth/session.ts";
export {
  sessionCookieOptions,
  clearSessionCookieOptions,
} from "./auth/cookie.ts";
export { getClientId } from "./auth/client-id.ts";
export {
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginRateLimit,
  type LoginRateLimitStatus,
} from "./auth/login-rate-limit.ts";
