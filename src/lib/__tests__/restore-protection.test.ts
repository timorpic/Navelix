import { it } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Load the real HTTP handlers with unavailable backup and storage/auth ports, never the live singleton.
async function handlerWithFailedProtection(file: string, directory: string): Promise<Record<string, (req: Request) => Promise<Response>>> {
  const modules: Record<string, string> = {
    "@/lib/auth": "export const requireAdmin=async()=>({id:'test-admin'}); export const verifyPassword=()=>true;",
    "@/lib/db": "export const db={prepare:()=>({get:()=>({password_hash:'test-hash'})})};",
    "@/lib/db-backup": "export const performDatabaseBackup=()=>null;",
    "@/lib/db-restore": "export const restoreDatabaseSnapshot=()=>{throw new Error('MUST NOT restore after failed backup')};",
    "@/lib/migrations": "export const runMigrations=()=>{};",
    "@/lib/audit": "export const recordAuditLog=()=>{};",
    "@/lib/logging/events": "export const writeLog=()=>{};",
    "@/lib/logging/request": "export const withRequestLogging=(_,handler)=>handler;",
    "@/lib/logging/transaction": "export const auditedTransaction=fn=>fn();",
    "@/lib/localized-json": "export const localizedJson=(value,init)=>Response.json(value,init);",
    "@/lib/license": "export const canAccessFeature=()=>true;",
    "@/lib/ee-bridge": "export const isEEAvailable=()=>true; export const CE_PRO_MESSAGE='CE';",
    "@/lib/data-dir": `export const resolveDataDir=()=>${JSON.stringify(directory)};`,
    "@/lib/storage-provider": `import fs from 'node:fs';
      export const getCloudStorageConfig=()=>({enabled:true,type:'s3'});
      export const downloadBackupFromStorage=async(_,__,target)=>{fs.writeFileSync(target,'downloaded');return {success:true}};
      export const saveCloudStorageConfig=()=>{};
      export const testStorageConnection=()=>{};
      export const uploadBackupToStorage=()=>{};
      export const listRemoteBackups=()=>[];`,
    "next/server": "export const NextResponse=Response;",
  };
  const compiled = await build({
    entryPoints: [file], bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent",
    plugins: [{ name: "restore-ports", setup(plugin) {
      plugin.onResolve({ filter: /^@\/|^next\/server$/ }, args => {
        if (!modules[args.path]) throw new Error(`Unmocked dependency ${args.path}`);
        return { path: args.path, namespace: "restore-ports" };
      });
      plugin.onLoad({ filter: /.*/, namespace: "restore-ports" }, args => ({ contents: modules[args.path], loader: "js" }));
    } }],
  });
  return await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`) as Record<string, (req: Request) => Promise<Response>>;
}

it("local restore stops with 503 before writing a temporary snapshot or restoring when protection fails", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "navelix-restore-protection-"));
  try {
    const route = await handlerWithFailedProtection("src/app/api/admin/backup/route.ts", dir);
    const body = new FormData();
    body.set("file", new Blob(["SQLite format 3\0test"]), "snapshot.db");
    body.set("confirmPassword", "fixture-confirmation");
    const response = await route.POST(new Request("http://localhost/api/admin/backup", { method: "POST", body }));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /保护性备份失败/);
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

it("cloud restore stops with 503 and removes the downloaded file when protection fails", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "navelix-cloud-protection-"));
  try {
    const route = await handlerWithFailedProtection("src/app/api/admin/storage/route.ts", dir);
    const response = await route.PUT(new Request("http://localhost/api/admin/storage", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore", fileName: "snapshot.db" }),
    }));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /保护性备份失败/);
    assert.deepEqual(fs.readdirSync(path.join(dir, "temp_restore")), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
