import { it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { build } from "esbuild";

async function migrationWithoutBackup(version: 11 | 15): Promise<(db: DatabaseSync) => void> {
  const compiled = await build({
    entryPoints: [`src/lib/migrations/versions/v${version}.ts`], bundle: true, write: false,
    format: "esm", platform: "node", logLevel: "silent",
    plugins: [{ name: "backup-unavailable", setup(plugin) {
      plugin.onResolve({ filter: /db-backup-core\.ts$/ }, () => ({ path: "backup", namespace: "backup-unavailable" }));
      plugin.onLoad({ filter: /.*/, namespace: "backup-unavailable" }, () => ({ contents: "export const createPhysicalBackup=()=>({ok:false,error:'unavailable'});" }));
    } }],
  });
  const mod = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`) as Record<string, (db: DatabaseSync) => void>;
  return mod[`migrateV${version}`];
}

for (const version of [11, 15] as const) {
  it(`v${version} preserves legacy schema and data when the pre-migration snapshot fails`, async () => {
    const migrate = await migrationWithoutBackup(version);
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("CREATE TABLE user_configs (user_id TEXT PRIMARY KEY, sensenova_password TEXT, model_monitor_enabled INTEGER)");
      db.exec("INSERT INTO user_configs VALUES ('fixture', 'retained', 1); CREATE TABLE model_accounts (id TEXT); INSERT INTO model_accounts VALUES ('retained')");
      assert.throws(() => migrate(db), /保护性备份失败/);
      assert.equal(db.prepare("SELECT sensenova_password FROM user_configs").get()?.sensenova_password, "retained");
      assert.equal(db.prepare("SELECT id FROM model_accounts").get()?.id, "retained");
      assert.equal(db.prepare("PRAGMA user_version").get()?.user_version, 0);
    } finally { db.close(); }
  });
  it(`v${version} does not require a snapshot when the legacy objects are absent`, async () => {
    const migrate = await migrationWithoutBackup(version);
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("CREATE TABLE user_configs (user_id TEXT PRIMARY KEY)");
      assert.doesNotThrow(() => migrate(db));
    } finally { db.close(); }
  });
}
