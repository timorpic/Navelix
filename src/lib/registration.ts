import { db } from "./db.ts";
import { getGlobalConfigRow } from "./global-config.ts";

/**
 * 判断系统当前是否允许新用户自主注册（公开策略，无需登录即可查询）。
 *
 * 规则与 POST /api/auth/register 的判定保持一致：
 * - 空库（尚无任何用户）：允许，首个注册者隐式成为管理员；
 * - 已有用户：以全站配置单例行的 allow_registration 为准（默认严格关闭）。
 *
 * 下沉动机：登录页 / 注册页为未登录公开页，无法走需 session 的 /api/user/data，
 * 需要一个无需鉴权即可读取注册开关的公开真源；同时避免该判定逻辑在
 * 注册接口与公开状态接口之间漂移。
 */
export function canRegister(): boolean {
  const count = (
    db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }
  ).c;
  if (count === 0) return true;

  const configRow = getGlobalConfigRow();
  return configRow?.allow_registration === 1;
}
