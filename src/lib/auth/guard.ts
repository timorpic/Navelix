import type { PublicUser } from "../db/types.ts";
import { getSessionUser } from "./session.ts";

/**
 * 路由鉴权守卫 —— 收敛此前散落在各 route.ts 的重复实现。
 *
 * 历史问题：`requireAdmin` 在 5 个 admin 路由里各自定义一遍（其中 admin/users
 * 的版本返回 `false` 而非 `null`，签名不一致），另有 11 处内联的
 * `if (!user || user.role !== "admin")` 判断。
 *
 * 设计约定（与 `lib/csrf.ts` 一致）：本模块**不构造 NextResponse**，
 * 只返回 user 或 null，错误文案与状态码由调用方组装。
 * 这样既保留了各路由原有的差异化文案，也让 lib 层保持零 HTTP 依赖。
 *
 * 注：普通登录校验直接用 `getSessionUser()` 即可，无需额外包装。
 */

/**
 * 要求管理员身份。非管理员或未登录均返回 null，调用方负责返回 403。
 *
 * 传入 `req` 时会优先从请求头读取 Bearer Token（Personal Access Token 鉴权路径），
 * 比依赖 `next/headers` 的隐式请求作用域更健壮。
 *
 * 注意：本函数不区分「未登录」与「非管理员」，因为既有路由对两者统一返回 403
 * （`Unauthorized access` / `需要管理员权限` 等）。若某个路由需要区分，请直接用
 * `getSessionUser` 再自行判断 role。
 */
export async function requireAdmin(req?: Request): Promise<PublicUser | null> {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}

