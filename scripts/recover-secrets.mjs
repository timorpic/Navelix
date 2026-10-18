import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { recoverEncryptedSecret } from "../src/lib/secret-recovery.ts";

// Explicit directory and offline acknowledgement prevent accidentally opening the default live database.
const args = process.argv.slice(2);
const migrate = args.includes("--migrate-legacy-fallback");
const directoryIndex = args.indexOf("--data-dir");
if (!args.includes("--confirm-offline") || directoryIndex < 0 || !args[directoryIndex + 1] || args[directoryIndex + 1].startsWith("--")) {
  throw new Error("Stop the application first. Usage: node scripts/recover-secrets.mjs --data-dir /absolute/restore-copy --confirm-offline [--migrate-legacy-fallback]");
}
const dataDir = path.resolve(args[directoryIndex + 1]);
const file = path.join(dataDir, "navelix.db");
if (!fs.statSync(file).isFile()) throw new Error("Existing database required");
process.env.NAVELIX_DATA_DIR = dataDir;
const db = new DatabaseSync(file, { readOnly: !migrate });
let transaction = false;
try {
  if (db.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok") throw new Error("Database integrity check failed");
  if (migrate) {
    const backup = path.join(dataDir, `before-secret-recovery-${Date.now()}.db`);
    db.exec(`VACUUM INTO '${backup.replaceAll("'", "''")}'`);
    fs.chmodSync(backup, 0o600);
  } else if (!process.env.APP_SECRET && !fs.existsSync(path.join(dataDir, ".app_secret"))) {
    throw new Error("Restore the original .app_secret or supply the original APP_SECRET before verification");
  }
  const { getSecretKey } = await import("../src/lib/secret.ts");
  const currentKey = getSecretKey();
  // The retired fallback is accepted only by this explicit offline migration, never by the application.
  const legacyKey = migrate ? createHash("sha256").update("navelix-embedded-master-secret-fallback").digest() : undefined;
  let checked = 0;
  let changed = 0;
  const recover = value => {
    if (typeof value !== "string" || !value.startsWith("enc:v1:")) return value;
    checked++;
    const result = recoverEncryptedSecret(value, currentKey, legacyKey);
    if (result !== value) changed++;
    return result;
  };
  const quote = name => `"${name.replaceAll('"', '""')}"`;
  if (migrate) { db.exec("BEGIN IMMEDIATE"); transaction = true; }
  // Restrict traversal to known secret-bearing columns; do not interpret users' notes or content.
  for (const [table, columns] of [
    ["user_configs", ["ai_api_key", "weather_api_key"]],
    ["user_notification_settings", ["bot_token"]],
    ["system_settings", ["value"]],
  ]) {
    const available = new Set(db.prepare(`PRAGMA table_info(${quote(table)})`).all().map(row => row.name));
    for (const column of columns.filter(name => available.has(name))) {
      for (const row of db.prepare(`SELECT rowid AS recovery_rowid, ${quote(column)} AS value${table === "system_settings" ? ', key' : ''} FROM ${quote(table)}`).all()) {
        let result = row.value;
        if (table === "system_settings" && row.key === "cloud_storage_config" && typeof row.value === "string") {
          const config = JSON.parse(row.value);
          for (const key of ["s3SecretKey", "webdavPassword", "encryptionPassphrase"]) if (typeof config[key] === "string") config[key] = recover(config[key]);
          result = JSON.stringify(config);
        } else if (table !== "system_settings" || ["ai_api_key", "weather_api_key", "telegram_bot_token"].includes(row.key)) {
          result = recover(row.value);
        }
        if (migrate && result !== row.value) db.prepare(`UPDATE ${quote(table)} SET ${quote(column)} = ? WHERE rowid = ?`).run(result, row.recovery_rowid);
      }
    }
  }
  if (transaction) { db.exec("COMMIT"); transaction = false; }
  console.log(JSON.stringify({ verified: checked, migrated: changed }));
} catch {
  if (transaction) db.exec("ROLLBACK");
  console.error("Secret recovery failed; no partial database changes were committed. Check original key materials and restore instructions.");
  process.exitCode = 1;
} finally { db.close(); }
