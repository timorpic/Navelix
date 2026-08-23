import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { migrateLegacyDatabase } from "./legacy-migration.ts";
import { initSchema } from "./schema.ts";
import { runMigrations } from "../migrations/index.ts";
import { resolveDataDir } from "../data-dir.ts";

// Server-only module: never import from client components.

const DATA_DIR = resolveDataDir();
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
} else {
  try {
    fs.chmodSync(DATA_DIR, 0o700);
  } catch {}
}

const DB_FILE = path.join(DATA_DIR, "navelix.db");

migrateLegacyDatabase(DATA_DIR, DB_FILE);

export const db = new DatabaseSync(DB_FILE);

try {
  if (fs.existsSync(DB_FILE)) {
    fs.chmodSync(DB_FILE, 0o600);
  }
} catch {}

// The module runs inside multiple Next.js build workers.
// 1) Set busy_timeout FIRST (it's a per-connection setting, no write lock needed),
//    so concurrent workers wait for the lock instead of failing immediately.
// 2) Then switch to WAL mode. This needs a write lock on the DB file header;
//    if another worker is already doing it, we get "database is locked" — ignore it,
//    since WAL mode is already active (or will be set by the winner).
db.exec("PRAGMA busy_timeout = 5000;");
db.exec("PRAGMA foreign_keys = ON;");
try {
  db.exec("PRAGMA journal_mode = WAL;");
} catch (e: unknown) {
  if (e instanceof Error && e.message.includes("locked")) {
    // Another worker beat us to switching to WAL — safe to proceed.
  } else {
    throw e;
  }
}

initSchema(db);

// 迁移逻辑已抽离至 src/lib/migrations/index.ts（Schema 版本 v1~v6 + 数据修复）
runMigrations(db);
