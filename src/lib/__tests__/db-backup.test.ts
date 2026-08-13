import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { performDatabaseBackup } from "../db-backup.ts";

describe("SQLite Automatic Backup Module", () => {
  it("should create a valid SQLite backup using VACUUM INTO", () => {
    const backupPath = performDatabaseBackup();
    assert.ok(backupPath, "Backup path should not be null");
    assert.equal(fs.existsSync(backupPath), true, "Backup file should exist on disk");
    assert.ok(fs.statSync(backupPath).size > 0, "Backup file should be non-empty");
  });
});
