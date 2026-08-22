import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, verifyPassword } from "@/lib/auth";
import { performDatabaseBackup } from "@/lib/db-backup";
import { runMigrations } from "@/lib/migrations";
import { recordAuditLog } from "@/lib/audit";
import { track } from "@/lib/analytics";
import { DEFAULT_SITE_TITLE } from "@/lib/constants";

async function requireAdmin(req?: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}

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

  // 可选遥测：手动热备份（规范 wiki/Analytics §4.5）
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

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "请上传有效的 .db 备份文件" }, { status: 400 });
    }

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
    const tempRestorePath = path.join(process.cwd(), "data", `restore-temp-${Date.now()}.db`);
    fs.writeFileSync(tempRestorePath, buffer);

    // 3. 将上传的数据库中的数据无缝同步还原至当前库
    const attachDbName = `restore_${Date.now()}`;
    const sanitizedPath = tempRestorePath.replace(/'/g, "''");
    db.exec(`ATTACH DATABASE '${sanitizedPath}' AS ${attachDbName};`);

    try {
      db.exec("BEGIN TRANSACTION;");
      // 还原全量业务与设置数据表
      const tables = [
        "users",
        "user_categories",
        "user_links",
        "user_configs",
        "projects",
        "user_todos",
        "api_tokens",
        "notifications",
      ];
      for (const t of tables) {
        try {
          db.exec(`DELETE FROM ${t};`);
          db.exec(`INSERT OR REPLACE INTO ${t} SELECT * FROM ${attachDbName}.${t};`);
        } catch {
          // 如果旧版本库中不存在某些表，安全跳过
        }
      }
      db.exec("COMMIT;");
    } catch (txErr) {
      db.exec("ROLLBACK;");
      throw txErr;
    } finally {
      try {
        db.exec(`DETACH DATABASE ${attachDbName};`);
      } catch {}
      try {
        fs.unlinkSync(tempRestorePath);
      } catch {}
    }

    // 4. 再次执行自动迁移确保结构最新
    runMigrations(db);

    // 5. 数据还原后的 Pro 商业字段合规性清洗与防护（防止在 CE/未授权环境下通过导入 .db 白嫖 Pro 特性）
    const { canAccessFeature } = await import("@/lib/license");
    const { isEEAvailable } = await import("@/lib/ee-bridge");
    const hasCodeInject = isEEAvailable() && canAccessFeature("custom_code_injection");
    const hasBrandCustom = isEEAvailable() && canAccessFeature("brand_customization");
    const hasProbes = isEEAvailable() && canAccessFeature("link_status_monitor");

    db.prepare(`
      UPDATE user_configs SET
        custom_head_scripts = CASE WHEN ? THEN custom_head_scripts ELSE '' END,
        custom_css = CASE WHEN ? THEN custom_css ELSE '' END,
        logo_image = CASE WHEN ? THEN logo_image ELSE '' END,
        site_title = CASE WHEN ? THEN site_title ELSE '${DEFAULT_SITE_TITLE}' END,
        logo_text = CASE WHEN ? THEN logo_text ELSE 'Navelix' END,
        link_status_enabled = CASE WHEN ? THEN link_status_enabled ELSE 0 END,
        link_status_interval = CASE WHEN ? THEN link_status_interval ELSE 60 END
    `).run(
      hasCodeInject ? 1 : 0,
      hasCodeInject ? 1 : 0,
      hasBrandCustom ? 1 : 0,
      hasBrandCustom ? 1 : 0,
      hasBrandCustom ? 1 : 0,
      hasProbes ? 1 : 0,
      hasProbes ? 1 : 0,
    );

    recordAuditLog({
      userId: adminUser.id,
      action: "database.restore.executed",
      target: "navelix.db",
      details: "管理员执行了数据库物理还原覆盖操作",
    });

    // 可选遥测：数据库还原（规范 wiki/Analytics §4.5）
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
