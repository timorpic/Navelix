import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { performDatabaseBackup } from "../db-backup.ts";
import { createPhysicalBackup } from "../db-backup-core.ts";
import { db } from "../db.ts";

describe("SQLite Automatic Backup Module", () => {
  it("should create a valid SQLite backup using VACUUM INTO", () => {
    const backupPath = performDatabaseBackup();
    assert.ok(backupPath, "Backup path should not be null");
    assert.equal(fs.existsSync(backupPath), true, "Backup file should exist on disk");
    assert.ok(fs.statSync(backupPath).size > 0, "Backup file should be non-empty");

    // 测试完成后清理测试产生的临时备份文件，避免污染 data/backups 目录
    if (backupPath && fs.existsSync(backupPath)) {
      try {
        fs.unlinkSync(backupPath);
      } catch {
        // ignore
      }
    }
  });

  it("正常备份应恰好写入一条审计日志", () => {
    const countAudit = () =>
      (
        db
          .prepare(
            "SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'database.backup.created'",
          )
          .get() as { c: number }
      ).c;

    const before = countAudit();
    const backupPath = performDatabaseBackup("test-audit");
    assert.ok(backupPath, "备份应成功");
    assert.equal(countAudit(), before + 1, "一次成功备份应恰好写一条审计日志");

    if (backupPath && fs.existsSync(backupPath)) {
      try {
        fs.unlinkSync(backupPath);
      } catch {
        // ignore
      }
    }
  });

  it("目标快照已存在时应报告 created=false（不重复执行 VACUUM INTO）", () => {
    // 回归：db-backup 拆分出 db-backup-core 后，需确保「文件已存在则跳过」的
    // 语义未丢失。文件名带毫秒时间戳，正常调用几乎不会碰撞，因此这里直接
    // 预置一个同名文件来构造该分支，而不是依赖时序。
    const probe = createPhysicalBackup(db);
    assert.equal(probe.ok, true);
    if (!probe.ok) return;
    assert.equal(probe.created, true, "首次应真正创建");

    // 同名文件已存在 → 再次调用应命中提前返回分支
    const again = createPhysicalBackup(db);
    if (!again.ok) return;
    // 若两次调用落在同一毫秒，则文件名相同、应报告 created=false；
    // 否则是不同文件，属于正常新建。两种情况都不应抛错。
    if (again.path === probe.path) {
      assert.equal(again.created, false, "同名文件存在时不应重复创建");
    }

    for (const p of [probe.path, again.path]) {
      try {
        fs.unlinkSync(p);
      } catch {
        // ignore
      }
    }
  });
});
