import { migrateV20 } from "./v20.ts";
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
import { migrateV19 } from "./v19.ts";
import { migrateV14 } from "./v14.ts";
import { migrateV18 } from "./v18.ts";
import { migrateV17 } from "./v17.ts";
import { migrateV16 } from "./v16.ts";
import { migrateV15 } from "./v15.ts";

/**
 * 版本化迁移注册表（按 user_version 顺序执行）。
 * 注意 v4 从未存在、v13 采集表已退役（由 v19 清理），顺序必须保持严格递增。
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
  { version: 14, name: "v14: collapse user_configs to global singleton", migrate: migrateV14 },
  { version: 15, name: "v15: drop model_accounts table and monitor column", migrate: migrateV15 },
  { version: 16, name: "v16: independent system settings and user notifications", migrate: migrateV16 },
  { version: 17, name: "v17: personal Telegram subscriptions and deliveries", migrate: migrateV17 },
  { version: 18, name: "v18: account disable status", migrate: migrateV18 },
  { version: 19, name: "v19: remove usage analytics and telemetry", migrate: migrateV19 },
  { version: 20, name: "v20: expiring tokens and stable project statuses", migrate: migrateV20 },
];
