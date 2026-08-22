import type { DatabaseSync } from "node:sqlite";
import { migrateV1 } from "./v1.ts";
import { migrateV2 } from "./v2.ts";
import { migrateV3 } from "./v3.ts";
import { migrateV5 } from "./v5.ts";
import { migrateV6 } from "./v6.ts";
import { migrateV7 } from "./v7.ts";
import { migrateV8 } from "./v8.ts";
import { migrateV9 } from "./v9.ts";
import { migrateV10 } from "./v10.ts";
import { migrateV11 } from "./v11.ts";
import { migrateV12 } from "./v12.ts";
import { migrateV13 } from "./v13.ts";

/**
 * 版本化迁移注册表（按 user_version 顺序执行）。
 * 注意 v4 从未存在（历史跳过），顺序必须保持严格递增。
 */
export const VERSIONED_MIGRATIONS: Array<{
  version: number;
  name: string;
  migrate: (db: DatabaseSync) => void;
}> = [
  { version: 1, name: "v1: social link defaults", migrate: migrateV1 },
  { version: 2, name: "v2: consolidate default categories", migrate: migrateV2 },
  { version: 3, name: "v3: rotate default weak admin password", migrate: migrateV3 },
  { version: 5, name: "v5: rebuild tables with FK cascade", migrate: migrateV5 },
  { version: 6, name: "v6: repair user_configs column misalignment", migrate: migrateV6 },
  { version: 7, name: "v7: seed vector illustration library", migrate: migrateV7 },
  { version: 8, name: "v8: update icon library descriptions", migrate: migrateV8 },
  { version: 9, name: "v9: clean up leftover test accounts", migrate: migrateV9 },
  { version: 10, name: "v10: drop legacy search engine columns", migrate: migrateV10 },
  { version: 11, name: "v11: drop legacy SenseNova columns", migrate: migrateV11 },
  { version: 12, name: "v12: create model_accounts table", migrate: migrateV12 },
  { version: 13, name: "v13: create analytics_events table", migrate: migrateV13 },
];