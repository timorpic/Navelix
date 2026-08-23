import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { getSessionUser } from "@/lib/auth";
import { canAccessFeature } from "@/lib/license";
import { isEEAvailable, CE_PRO_MESSAGE } from "@/lib/ee-bridge";
import { DEFAULT_SITE_TITLE } from "@/lib/constants";
import { resolveDataDir } from "@/lib/data-dir";
import {
  getCloudStorageConfig,
  saveCloudStorageConfig,
  testStorageConnection,
  uploadBackupToStorage,
  listRemoteBackups,
  downloadBackupFromStorage,
  type CloudStorageConfig,
} from "@/lib/storage-provider";
import { performDatabaseBackup } from "@/lib/db-backup";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/lib/audit";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  const isPro = isEEAvailable() && canAccessFeature("s3_backup");
  const cfg = getCloudStorageConfig();

  // 敏感字段掩码脱敏
  const masked = {
    ...cfg,
    s3SecretKey: cfg.s3SecretKey ? "••••••••••••••••" : "",
    webdavPassword: cfg.webdavPassword ? "••••••••••••••••" : "",
    encryptionPassphrase: cfg.encryptionPassphrase ? "••••••••••••••••" : "",
    isPro,
    isEE: isEEAvailable(),
  };

  return NextResponse.json(masked);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  if (!isEEAvailable()) {
    return NextResponse.json({ error: CE_PRO_MESSAGE }, { status: 403 });
  }

  if (!canAccessFeature("s3_backup")) {
    return NextResponse.json({ error: "异地云备份与还原为 Navelix Pro 专享功能，请先激活商业许可证" }, { status: 403 });
  }

  let body: Partial<CloudStorageConfig>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求数据" }, { status: 400 });
  }

  const existing = getCloudStorageConfig();
  const nextConfig: CloudStorageConfig = {
    enabled: Boolean(body.enabled),
    type: body.type || "none",
    s3Endpoint: body.s3Endpoint?.trim() || "",
    s3Region: body.s3Region?.trim() || "us-east-1",
    s3Bucket: body.s3Bucket?.trim() || "",
    s3AccessKey: body.s3AccessKey?.trim() || "",
    // 如果用户提交了掩码字符串，保留已有密码
    s3SecretKey:
      body.s3SecretKey && !body.s3SecretKey.includes("••")
        ? body.s3SecretKey.trim()
        : existing.s3SecretKey || "",
    s3PathPrefix: body.s3PathPrefix?.trim() || "",
    s3ForcePathStyle: Boolean(body.s3ForcePathStyle),
    webdavUrl: body.webdavUrl?.trim() || "",
    webdavUsername: body.webdavUsername?.trim() || "",
    webdavPassword:
      body.webdavPassword && !body.webdavPassword.includes("••")
        ? body.webdavPassword.trim()
        : existing.webdavPassword || "",
    autoBackupDaily: Boolean(body.autoBackupDaily),
    keepCopies: typeof body.keepCopies === "number" ? body.keepCopies : 7,
    encryptionPassphrase:
      body.encryptionPassphrase && !body.encryptionPassphrase.includes("••")
        ? body.encryptionPassphrase.trim()
        : existing.encryptionPassphrase || "",
  };

  saveCloudStorageConfig(nextConfig);

  recordAuditLog({
    userId: user.id,
    action: "storage.config.updated",
    details: `更新云端异地备份配置 (类型: ${nextConfig.type})`,
  });

  return NextResponse.json({ success: true, message: "云存储配置已安全保存" });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  if (!isEEAvailable()) {
    return NextResponse.json({ error: CE_PRO_MESSAGE }, { status: 403 });
  }

  if (!canAccessFeature("s3_backup")) {
    return NextResponse.json({ error: "异地云备份与还原为 Navelix Pro 专享功能，请先激活商业许可证" }, { status: 403 });
  }

  let body: { action?: string; fileName?: string; tempConfig?: Partial<CloudStorageConfig> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求格式" }, { status: 400 });
  }

  const { action, fileName, tempConfig } = body;
  const cfg = getCloudStorageConfig();
  const effectiveConfig = tempConfig
    ? {
        ...cfg,
        ...tempConfig,
        s3SecretKey: tempConfig.s3SecretKey && !tempConfig.s3SecretKey.includes("••") ? tempConfig.s3SecretKey : cfg.s3SecretKey,
        webdavPassword: tempConfig.webdavPassword && !tempConfig.webdavPassword.includes("••") ? tempConfig.webdavPassword : cfg.webdavPassword,
      }
    : cfg;

  if (action === "test") {
    const res = await testStorageConnection(effectiveConfig);
    return NextResponse.json(res);
  }

  if (action === "backup_now") {
    if (effectiveConfig.type === "none") {
      return NextResponse.json({ error: "请先配置并启用 S3 或 WebDAV 存储" }, { status: 400 });
    }

    const localBackupPath = performDatabaseBackup(user.id);
    if (!localBackupPath) {
      return NextResponse.json({ error: "生成本地 SQLite 数据库物理快照失败" }, { status: 500 });
    }

    const snapshotFileName = path.basename(localBackupPath);
    const uploadRes = await uploadBackupToStorage(effectiveConfig, localBackupPath, snapshotFileName);

    if (!uploadRes.success) {
      return NextResponse.json({ error: `上传至云端失败: ${uploadRes.error}` }, { status: 500 });
    }

    recordAuditLog({
      userId: user.id,
      action: "storage.backup.manual_uploaded",
      target: snapshotFileName,
      details: `成功将物理快照上传至远程云存储: ${snapshotFileName}`,
    });

    return NextResponse.json({
      success: true,
      message: `🎉 快照已成功加密上传至云端 (${snapshotFileName})`,
    });
  }

  if (action === "list") {
    if (effectiveConfig.type === "none") {
      return NextResponse.json({ backups: [] });
    }
    const backups = await listRemoteBackups(effectiveConfig);
    return NextResponse.json({ backups });
  }

  if (action === "restore") {
    if (!fileName || typeof fileName !== "string" || !fileName.endsWith(".db")) {
      return NextResponse.json({ error: "无效的快照文件名" }, { status: 400 });
    }

    const tempDir = path.join(resolveDataDir(), "temp_restore");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true, mode: 0o700 });
    }
    const tempFile = path.join(tempDir, `restore-${Date.now()}.db`);

    const dlRes = await downloadBackupFromStorage(effectiveConfig, fileName, tempFile);
    if (!dlRes.success) {
      return NextResponse.json({ error: `从云端拉取快照失败: ${dlRes.error}` }, { status: 500 });
    }

    // 执行安全还原：先对当前库做回滚保护快照
    performDatabaseBackup("system-before-cloud-restore");

    try {
      // 验证下载的 SQLite 文件的合法性
      const { DatabaseSync } = await import("node:sqlite");
      const testDb = new DatabaseSync(tempFile, { readOnly: true });
      const testCheck = testDb.prepare("PRAGMA integrity_check").all() as Array<{ integrity_check: string }>;
      testDb.close();

      if (!testCheck || testCheck[0]?.integrity_check !== "ok") {
        fs.unlinkSync(tempFile);
        return NextResponse.json({ error: "云端拉取的数据库文件损坏，已终止还原" }, { status: 400 });
      }

      // 使用 SQLite ATTACH 在线原子事务还原，避免 db.close() 销毁全局连接句柄
      try {
        db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
      } catch {}

      const tables = [
        "users",
        "user_categories",
        "user_links",
        "quick_access_links",
        "team_categories",
        "team_category_subscriptions",
        "projects",
        "todos",
        "system_settings",
        "audit_logs",
        "notifications",
        "monitor_accounts",
        "api_tokens",
        "link_usage_stats",
        "migrations_meta",
      ];

      db.exec(`ATTACH DATABASE '${tempFile.replace(/'/g, "''")}' AS cloud_snapshot;`);
      try {
        db.exec("BEGIN IMMEDIATE;");
        for (const tbl of tables) {
          try {
            db.exec(`DELETE FROM main.${tbl};`);
            db.exec(`INSERT OR REPLACE INTO main.${tbl} SELECT * FROM cloud_snapshot.${tbl};`);
          } catch {
            // 容错：个别非核心可选表不存在时跳过
          }
        }
        db.exec("COMMIT;");

        // 还原后的 Pro 商业特权字段合规性清洗与原子置空（防止通过导入云端快照白嫖 Pro 特性）
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
      } catch (txnErr) {
        db.exec("ROLLBACK;");
        throw txnErr;
      } finally {
        try {
          db.exec("DETACH DATABASE cloud_snapshot;");
        } catch {}
        try {
          fs.unlinkSync(tempFile);
        } catch {}
      }

      recordAuditLog({
        userId: user.id,
        action: "storage.database.restored_from_cloud",
        target: fileName,
        details: `成功从云端快照还原系统数据库: ${fileName}`,
      });

      return NextResponse.json({
        success: true,
        message: "🎉 数据库已从云端快照成功还原！建议刷新页面生效。",
      });
    } catch (err) {
      return NextResponse.json(
        { error: `还原数据库异常: ${err instanceof Error ? err.message : String(err)}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: "不支持的操作" }, { status: 400 });
}
