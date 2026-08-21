// 聚合入口：保持外部导入路径 @/lib/db 与 ./db.ts 的公开 API 不变。
// 内部职责拆分至 ./db/ 子目录：
// - connection.ts        DB 实例化 + PRAGMA + 目录初始化 + 触发 legacy 迁移 / initSchema / runMigrations
// - schema.ts           初始 CREATE TABLE / CREATE INDEX DDL
// - seed.ts             seedUserData（首次创建用户时的种子数据）
// - legacy-migration.ts 旧库 nexus.db → navelix.db 自动迁移
// - types.ts            常量与类型（SESSION_COOKIE / SESSION_TTL_MS / UserRow / PublicUser）
export { db } from "./db/connection.ts";
export { seedUserData } from "./db/seed.ts";
export {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  type UserRow,
  type PublicUser,
} from "./db/types.ts";
