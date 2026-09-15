// 数据库相关常量与类型定义。
// 从原 db.ts 抽离，保持外部导入路径 @/lib/db 与 ./db.ts 的公开 API 不变。

export const SESSION_COOKIE = "navelix_session";
/** 连续活跃时，每次续期后的最大空闲时长。 */
export const SESSION_IDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** 从首次登录起的硬上限；到期后必须重新验证身份。 */
export const SESSION_MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  email?: string;
  bio?: string;
  role: string;
  avatar: string;
  created_at: number;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  bio: string;
  role: "admin" | "user";
  avatar: string;
}
