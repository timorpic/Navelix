import { auditedTransaction } from "@/lib/logging/transaction";
import { withRequestLogging } from "@/lib/logging/request";
import { localizedJson } from "@/lib/localized-json";
import { restoreDatabaseSnapshot } from "@/lib/db-restore";
import { NextRequest } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { requireAdmin } from "@/lib/auth";
import { canAccessFeature } from "@/lib/license";
import { isEEAvailable, CE_PRO_MESSAGE } from "@/lib/ee-bridge";
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

async function GETHandler() {
  const user = await requireAdmin();
  if (!user) {
    return localizedJson({ error: "需要管理员权限" }, { status: 403 });
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

  return localizedJson(masked);
}

async function POSTHandler(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return localizedJson({ error: "需要管理员权限" }, { status: 403 });
  }

  if (!isEEAvailable()) {
    return localizedJson({ error: CE_PRO_MESSAGE }, { status: 403 });
  }

  if (!canAccessFeature("s3_backup")) {
    return localizedJson({ error: "异地云备份与还原为 Navelix Pro 专享功能，请先激活商业许可证" }, { status: 403 });
  }

  let body: Partial<CloudStorageConfig>;
  try {
    body = await req.json();
  } catch {
    return localizedJson({ error: "无效的请求数据" }, { status: 400 });
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

  auditedTransaction(() => {
  saveCloudStorageConfig(nextConfig);

  recordAuditLog({
    userId: user.id,
    action: "storage.config.updated",
    details: `更新云端异地备份配置 (类型: ${nextConfig.type})`,
  });

  });
  return localizedJson({ success: true, message: "云存储配置已安全保存" });
}

async function PUTHandler(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return localizedJson({ error: "需要管理员权限" }, { status: 403 });
  }

  if (!isEEAvailable()) {
    return localizedJson({ error: CE_PRO_MESSAGE }, { status: 403 });
  }

  if (!canAccessFeature("s3_backup")) {
    return localizedJson({ error: "异地云备份与还原为 Navelix Pro 专享功能，请先激活商业许可证" }, { status: 403 });
  }

  let body: { action?: string; fileName?: string; tempConfig?: Partial<CloudStorageConfig> };
  try {
    body = await req.json();
  } catch {
    return localizedJson({ error: "无效的请求格式" }, { status: 400 });
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
    return localizedJson(res);
  }

  if (action === "backup_now") {
    if (effectiveConfig.type === "none") {
      return localizedJson({ error: "请先配置并启用 S3 或 WebDAV 存储" }, { status: 400 });
    }

    const localBackupPath = performDatabaseBackup(user.id);
    if (!localBackupPath) {
      return localizedJson({ error: "生成本地 SQLite 数据库物理快照失败" }, { status: 500 });
    }

    const snapshotFileName = path.basename(localBackupPath);
    const uploadRes = await uploadBackupToStorage(effectiveConfig, localBackupPath, snapshotFileName);

    if (!uploadRes.success) {
      return localizedJson({ error: `上传至云端失败: ${uploadRes.error}` }, { status: 500 });
    }

    recordAuditLog({
      userId: user.id,
      action: "storage.backup.manual_uploaded",
      target: snapshotFileName,
      details: `成功将物理快照上传至远程云存储: ${snapshotFileName}`,
    });

    return localizedJson({
      success: true,
      message: `🎉 快照已成功加密上传至云端 (${snapshotFileName})`,
    });
  }

  if (action === "list") {
    if (effectiveConfig.type === "none") {
      return localizedJson({ backups: [] });
    }
    const backups = await listRemoteBackups(effectiveConfig);
    return localizedJson({ backups });
  }

  if (action === "restore") {
    if (!fileName || typeof fileName !== "string" || !fileName.endsWith(".db")) {
      return localizedJson({ error: "无效的快照文件名" }, { status: 400 });
    }

    const tempDir = path.join(resolveDataDir(), "temp_restore");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true, mode: 0o700 });
    }
    const tempFile = path.join(tempDir, `restore-${Date.now()}.db`);

    const dlRes = await downloadBackupFromStorage(effectiveConfig, fileName, tempFile);
    if (!dlRes.success) {
      return localizedJson({ error: `从云端拉取快照失败: ${dlRes.error}` }, { status: 500 });
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
        return localizedJson({ error: "云端拉取的数据库文件损坏，已终止还原" }, { status: 400 });
      }

      try {
        restoreDatabaseSnapshot(db, tempFile);
      } finally {
        try { fs.unlinkSync(tempFile); } catch { /* best effort */ }
      }

      recordAuditLog({
        userId: user.id,
        action: "storage.database.restored_from_cloud",
        target: fileName,
        details: `成功从云端快照还原系统数据库: ${fileName}`,
      });

      return localizedJson({
        success: true,
        message: "🎉 数据库已从云端快照成功还原！建议刷新页面生效。",
      });
    } catch (err) {
      return localizedJson(
        { error: `还原数据库异常: ${err instanceof Error ? err.message : String(err)}` },
        { status: 500 },
      );
    }
  }

  return localizedJson({ error: "不支持的操作" }, { status: 400 });
}

export const GET = withRequestLogging("/api/admin/storage", GETHandler);
export const POST = withRequestLogging("/api/admin/storage", POSTHandler);
export const PUT = withRequestLogging("/api/admin/storage", PUTHandler);
