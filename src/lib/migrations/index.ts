// 迁移统一入口：完整迁移逻辑见 run.ts（编排器），
// 版本化迁移见 versions/（v1~v12），始终执行的结构修复见 schema.ts，数据修复见 data.ts，帮助函数见 shared.ts
export { runMigrations } from "./run.ts";