import { restoreDatabaseSnapshot } from "@/lib/db-restore";
import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, verifyPassword } from "@/lib/auth";
import { performDatabaseBackup } from "@/lib/db-backup";
import { runMigrations } from "@/lib/migrations";
import { recordAuditLog } from "@/lib/audit";
import { track } from "@/lib/analytics";
import { resolveDataDir } from "@/lib/data-dir";

// GET: 下载当前 SQLite 数据库的物理快照备份文件 (.db)
export async function GET(req: NextRequest) {
  const adminUser = await requireAdmin(req);
  if (!adminUser) {
    return NextResponse.json({ error: "无权访问，仅管理员可下载数据库备份" }, { status: 403 });
  }

  const backupFilePath = performDatabaseBackup(adminUser.id);
  if (!backupFilePath || !fs.existsSync(backupFilePath)) {
    return NextResponse.json({ error: "创建数据库快照失败" }, { status: 500 });
  }

  const fileBuffer = fs.readFileSync(backupFilePath);
  const nowStr = new Date().toISOString().slice(0, 10);
  const fileName = `navelix-backup-${nowStr}.db`;

  // 可选遥测：手动热备份
  track("backup.create", {
    userId: adminUser.id,
    meta: { sizeBytes: fileBuffer.length, destination: "local" },
  });

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/x-sqlite3",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(fileBuffer.length),
    },
  });
}

// POST: 上传 .db 备份文件并恢复还原数据库
export async function POST(req: NextRequest) {
  const adminUser = await requireAdmin(req);
  if (!adminUser) {
    return NextResponse.json({ error: "无权访问，仅管理员可恢复数据库" }, { status: 403 });
  }

  // 解析上传体单独处理：Content-Type 不对时 req.formData() 会抛错，
  // 若与还原逻辑共用一个 catch，客户端错误会被报成 500「数据库恢复失败」。
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "请求格式错误，请以 multipart/form-data 上传 .db 备份文件" },
      { status: 400 },
    );
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "请上传有效的 .db 备份文件" }, { status: 400 });
  }

  try {
    // 二次确认：恢复操作会整体覆盖数据库，必须验证当前管理员密码，
    // 防止管理员会话被盗后（但密码未泄露）被攻击者直接覆写数据库。
    const confirmPassword = String(formData.get("confirmPassword") || "");
    const adminRow = db
      .prepare("SELECT password_hash FROM users WHERE id = ?")
      .get(adminUser.id) as { password_hash: string } | undefined;
    if (!adminRow || !verifyPassword(confirmPassword, adminRow.password_hash)) {
      return NextResponse.json(
        { error: "恢复数据库需输入当前管理员密码进行二次确认" },
        { status: 403 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 校验 SQLite 魔数 Header: "SQLite format 3\0"
    const SQLITE_HEADER = "SQLite format 3\0";
    const headerString = buffer.subarray(0, 16).toString("utf-8");
    if (!headerString.startsWith(SQLITE_HEADER)) {
      return NextResponse.json({ error: "上传的文件并非合法的 SQLite 数据库文件" }, { status: 400 });
    }

    // 1. 先将当前数据库在线备份一份以防万一
    performDatabaseBackup();

    // 2. 写入临时恢复文件
    const tempRestorePath = path.join(resolveDataDir(), `restore-temp-${Date.now()}.db`);
    fs.writeFileSync(tempRestorePath, buffer);

    try {
      restoreDatabaseSnapshot(db, tempRestorePath);
    } finally {
      try { fs.unlinkSync(tempRestorePath); } catch { /* best effort */ }
    }

    // 4. 再次执行自动迁移确保结构最新
    runMigrations(db);

    recordAuditLog({
      userId: adminUser.id,
      action: "database.restore.executed",
      target: "navelix.db",
      details: "管理员执行了数据库物理还原覆盖操作",
    });

    // 可选遥测：数据库还原
    track("backup.restore", { userId: adminUser.id, meta: { source: "upload" } });

    return NextResponse.json({
      success: true,
      message: "数据库已成功还原恢复！",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "恢复数据库失败";
    console.error("[Database Restore Error]:", err);
    return NextResponse.json({ error: `数据库恢复失败: ${msg}` }, { status: 500 });
  }
}
