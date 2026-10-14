import { it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

it("the test runner overrides a caller's data directory and cleans its own directory", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "navelix-isolation-check-"));
  try {
    const sentinel = join(sandbox, "navelix-admin-password.txt");
    writeFileSync(sentinel, "preserve-this-placeholder");
    const testFile = join(sandbox, "probe.test.ts");
    const captured = join(sandbox, "captured.txt");
    writeFileSync(testFile, `import { writeFileSync } from 'node:fs';\nimport { db } from ${JSON.stringify(resolve('src/lib/db.ts'))};\nwriteFileSync(${JSON.stringify(captured)}, process.env.NAVELIX_DATA_DIR!);\ndb.prepare('SELECT 1').get();\n`);
    const result = spawnSync(process.execPath, ["scripts/run-tests.mjs", testFile], { env: { ...process.env, NAVELIX_DATA_DIR: sandbox }, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(sentinel, "utf8"), "preserve-this-placeholder");
    assert.ok(!readdirSync(sandbox).includes("navelix.db"));
    const actual = readFileSync(captured, "utf8");
    assert.notEqual(actual, sandbox);
    const parent = actual.slice(0, actual.lastIndexOf('/'));
    assert.ok(!readdirSync(parent).includes(actual.slice(actual.lastIndexOf('/') + 1)));
  } finally { rmSync(sandbox, { recursive: true, force: true }); }
});
