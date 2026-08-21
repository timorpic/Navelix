// 数据库相关常量与类型定义。
// 从原 db.ts 抽离，保持外部导入路径 @/lib/db 与 ./db.ts 的公开 API 不变。

export const SESSION_COOKIE = "navelix_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
