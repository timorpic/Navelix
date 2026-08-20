import { db } from "./db.ts";
import { encryptSecret, decryptSecret } from "./secret.ts";

export type StorageType = "none" | "s3" | "webdav";

export interface CloudStorageConfig {
  enabled: boolean;
  type: StorageType;
  // S3-Compatible
  s3Endpoint?: string;
  s3Region?: string;
  s3Bucket?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  s3PathPrefix?: string;
  s3ForcePathStyle?: boolean;
  // WebDAV
  webdavUrl?: string;
  webdavUsername?: string;
  webdavPassword?: string;
  // General Options
  autoBackupDaily?: boolean;
  keepCopies?: number;
  encryptionPassphrase?: string;
  updatedAt?: number;
}

export interface RemoteBackupItem {
  name: string;
  size: number;
  lastModified: string;
  url?: string;
}

const SETTINGS_KEY = "cloud_storage_config";

/**
 * 获取云存储配置（密码与 Secret 字段已自动解密）
 */
export function getCloudStorageConfig(): CloudStorageConfig {
  try {
    const row = db
      .prepare("SELECT value FROM system_settings WHERE key = ?")
      .get(SETTINGS_KEY) as { value: string } | undefined;
    if (!row?.value) {
      return { enabled: false, type: "none", keepCopies: 7 };
    }
    const parsed = JSON.parse(row.value) as CloudStorageConfig;
    if (parsed.s3SecretKey) {
      parsed.s3SecretKey = decryptSecret(parsed.s3SecretKey);
    }
    if (parsed.webdavPassword) {
      parsed.webdavPassword = decryptSecret(parsed.webdavPassword);
    }
    if (parsed.encryptionPassphrase) {
      parsed.encryptionPassphrase = decryptSecret(parsed.encryptionPassphrase);
    }
    return parsed;
  } catch {
    return { enabled: false, type: "none", keepCopies: 7 };
  }
}

/**
 * 保存云存储配置（密码与 Secret 字段经过 AES-256-GCM 强加密入库）
 */
export function saveCloudStorageConfig(cfg: CloudStorageConfig): void {
  const toSave: CloudStorageConfig = {
    ...cfg,
    s3SecretKey: cfg.s3SecretKey ? encryptSecret(cfg.s3SecretKey) : "",
    webdavPassword: cfg.webdavPassword ? encryptSecret(cfg.webdavPassword) : "",
    encryptionPassphrase: cfg.encryptionPassphrase ? encryptSecret(cfg.encryptionPassphrase) : "",
    updatedAt: Date.now(),
  };

  db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(SETTINGS_KEY, JSON.stringify(toSave), Date.now());
}

import { getStorageDriver } from "./ee-bridge/index.ts";

// ═══════════════════════════════════════════════════════════════
// 云存储统一接口操作 (S3 / WebDAV) - 委托至 EE 商业驱动模块
// ═══════════════════════════════════════════════════════════════

export async function testStorageConnection(cfg: CloudStorageConfig): Promise<{ success: boolean; message: string }> {
  return getStorageDriver().testConnection(cfg);
}

export async function uploadBackupToStorage(
  cfg: CloudStorageConfig,
  localFilePath: string,
  fileName: string,
): Promise<{ success: boolean; error?: string }> {
  return getStorageDriver().uploadBackup(cfg, localFilePath, fileName);
}

export async function listRemoteBackups(cfg: CloudStorageConfig): Promise<RemoteBackupItem[]> {
  return getStorageDriver().listBackups(cfg);
}

export async function downloadBackupFromStorage(
  cfg: CloudStorageConfig,
  fileName: string,
  targetLocalPath: string,
): Promise<{ success: boolean; error?: string }> {
  return getStorageDriver().downloadBackup(cfg, fileName, targetLocalPath);
}

