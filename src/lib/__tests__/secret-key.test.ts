import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { getSecretKey } from "../secret.ts";

function isolatedKeyDirectory(run: (dir: string) => void) {
  const previousDir = process.env.NAVELIX_DATA_DIR;
  const previousSecret = process.env.APP_SECRET;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "navelix-key-test-"));
  process.env.NAVELIX_DATA_DIR = dir;
  delete process.env.APP_SECRET;
  try { run(dir); }
  finally {
    if (previousDir === undefined) delete process.env.NAVELIX_DATA_DIR; else process.env.NAVELIX_DATA_DIR = previousDir;
    if (previousSecret === undefined) delete process.env.APP_SECRET; else process.env.APP_SECRET = previousSecret;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("master key failure boundaries", () => {
  it("persists a private key and reuses it without replacement", () => isolatedKeyDirectory(dir => {
    const key = getSecretKey();
    assert.equal(key.length, 32);
    assert.deepEqual(getSecretKey(), key);
    assert.equal(fs.statSync(path.join(dir, ".app_secret")).mode & 0o777, 0o600);
  }));
  it("rejects damaged and non-regular key files without replacing them", () => isolatedKeyDirectory(dir => {
    const file = path.join(dir, ".app_secret");
    const corrupt = "z".repeat(64);
    fs.writeFileSync(file, corrupt);
    assert.throws(getSecretKey);
    assert.equal(fs.readFileSync(file, "utf8"), corrupt);
    fs.unlinkSync(file);
    fs.mkdirSync(file);
    assert.throws(getSecretKey);
  }));
  it("rejects an invalid environment secret rather than silently choosing a different key", () => isolatedKeyDirectory(() => {
    process.env.APP_SECRET = "short";
    assert.throws(getSecretKey, /16/);
  }));
  it("fails closed when the data path is not writable as a directory", () => isolatedKeyDirectory(dir => {
    const file = path.join(dir, "not-a-directory");
    fs.writeFileSync(file, "");
    process.env.NAVELIX_DATA_DIR = file;
    assert.throws(getSecretKey);
  }));
  it("publishes the same complete key to concurrent processes", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "navelix-key-race-"));
    const moduleURL = pathToFileURL(path.resolve("src/lib/secret.ts")).href;
    try {
      const keys = await Promise.all(Array.from({ length: 4 }, () => new Promise<string>((resolve, reject) => {
        const child = spawn(process.execPath, ["--experimental-strip-types", "--input-type=module", "--eval", `import { getSecretKey } from ${JSON.stringify(moduleURL)}; process.stdout.write(getSecretKey().toString('hex'));`], {
          env: { ...process.env, APP_SECRET: "", NAVELIX_DATA_DIR: dir }, stdio: ["ignore", "pipe", "pipe"],
        });
        let output = "";
        child.stdout.on("data", chunk => { output += String(chunk); });
        child.once("error", reject);
        child.once("exit", code => code === 0 ? resolve(output) : reject(new Error("Key worker failed")));
      })));
      assert.equal(new Set(keys).size, 1);
      assert.match(keys[0], /^[a-f0-9]{64}$/);
      assert.equal(fs.readdirSync(dir).filter(name => name.endsWith(".tmp")).length, 0);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
