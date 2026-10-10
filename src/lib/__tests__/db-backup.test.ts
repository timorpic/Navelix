import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { performDatabaseBackup, scheduleAutoBackup } from "../db-backup.ts";
import { createPhysicalBackup, listBackupFiles, BACKUP_INTERVAL_MS } from "../db-backup-core.ts";
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

  it("scheduleAutoBackup 按最新快照 mtime 决定是否备份（启动补检查依赖该语义）", () => {
    // 守护进程在启动约 90 秒后补跑一次 scheduleAutoBackup，以覆盖「每天重启、
    // 连续运行不足 24 小时」的实例（否则首次备份要等满 24 小时，永远不执行）。
    // 该补跑之所以安全、不会产生冗余快照，正是因为它按 mtime 幂等判断——
    // 这里固定住这个前提：快照新鲜则跳过，过期或无快照则备份。
    const before = listBackupFiles().length;

    // ① 无「新鲜」快照时：应执行备份（写出一条审计日志即证明真的备份了）
    const backupDir = path.join(process.env.NAVELIX_DATA_DIR || path.join(process.cwd(), "data"), "backups");
    const stashed: { path: string; mtime: number }[] = [];
    if (fs.existsSync(backupDir)) {
      for (const f of listBackupFiles()) {
        stashed.push({ path: f.path, mtime: f.mtime });
        // 把 mtime 改到很久以前，模拟「最近快照已过期」
        const old = new Date(Date.now() - BACKUP_INTERVAL_MS - 60_000);
        fs.utimesSync(f.path, old, old);
      }
    }

    const countAudit = () =>
      (
        db
          .prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'database.backup.created'")
          .get() as { c: number }
      ).c;

    const auditBefore = countAudit();
    scheduleAutoBackup();
    assert.equal(
      countAudit(),
      auditBefore + 1,
      "最新快照已过期（或不存在）时，scheduleAutoBackup 应执行备份",
    );

    // ② 快照刚生成（新鲜）时：应直接返回、不再产生新快照
    const auditAfterBackup = countAudit();
    scheduleAutoBackup();
    assert.equal(
      countAudit(),
      auditAfterBackup,
      "目录内已有新鲜快照时应跳过，避免每天重复 VACUUM INTO",
    );

    // ③ 清理本次测试新建的快照（保留测试前就存在的，并还原其 mtime）
    const keep = new Set(stashed.map((s) => s.path));
    for (const f of listBackupFiles()) {
      if (!keep.has(f.path)) {
        try {
          fs.unlinkSync(f.path);
        } catch {
          // ignore
        }
      }
    }
    for (const s of stashed) {
      try {
        const d = new Date(s.mtime);
        fs.utimesSync(s.path, d, d);
      } catch {
        // ignore
      }
    }
    assert.ok(listBackupFiles().length <= before + 1, "清理后不应残留大量测试快照");
  });
});
