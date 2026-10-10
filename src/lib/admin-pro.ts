/**
 * 「Pro 商业授权」Tab（`admin-pro-tab.tsx`，原 1018 行）的纯逻辑。
 *
 * 从该文件下沉 —— 授权状态与云存储配置的响应解析、激活请求体组装、
 * 授权信息与云端快照条目的展示格式化，原先都内联在组件里无法被单测覆盖。
 * 本模块不含任何 React 依赖；React 状态与副作用见
 * `@/hooks/use-admin-license` 与 `@/hooks/use-admin-cloud-storage`。
 */

import type {
  CloudStorageConfig,
  RemoteBackupItem,
  StorageType,
} from "./storage-provider.ts";

// ═══════════════════════════════════════════════════════════════
// License 商业授权
// ═══════════════════════════════════════════════════════════════

export interface LicensePayload {
  licenseId: string;
  customer: string;
  email: string;
  plan: string;
  features: string[];
  expiresAt: number;
  maxSeats?: number;
  fingerprint?: string;
}

export interface LicenseStatus {
  isPro: boolean;
  isEE?: boolean;
  isDockerBuild?: boolean;
  payload?: LicensePayload;
  error?: string;
}

export interface LicenseFetchResult {
  /** 原实现把响应整体写入 state，故此处同样透传（含 machineFingerprint 等额外字段） */
  status: LicenseStatus;
  /** 服务端未下发指纹时为空串（原实现仅在字段存在时覆盖） */
  machineFingerprint: string;
}

/** 解析 GET /api/admin/license 的响应；非对象响应视为无效。 */
export function parseLicenseStatus(data: unknown): LicenseFetchResult | null {
  if (!data || typeof data !== "object") return null;
  const d = data as LicenseStatus & { machineFingerprint?: unknown };
  return {
    status: d,
    machineFingerprint: d.machineFingerprint ? String(d.machineFingerprint) : "",
  };
}

/** 授权卡片标题：Pro / 官方镜像版 / 源码开发版。 */
export function licenseTitle(status: LicenseStatus): string {
  if (status.isPro) return "Navelix Pro 商业版";
  if (status.isDockerBuild) return "Navelix 官方镜像版";
  return "Navelix 源码开发版";
}

/** 状态徽标分支，判定顺序与原三元链一致：pro → docker → ee → source。 */
export type LicenseBadgeKind = "pro" | "docker" | "ee" | "source";

export function licenseBadgeKind(status: LicenseStatus): LicenseBadgeKind {
  if (status.isPro) return "pro";
  if (status.isDockerBuild) return "docker";
  if (status.isEE) return "ee";
  return "source";
}

/** Pro 计划名：pro_lifetime 为终身买断，其余（含缺失）一律高级订阅。 */
export function licensePlanLabel(payload?: LicensePayload): string {
  return payload?.plan === "pro_lifetime" ? "终身买断" : "高级订阅";
}

/** 有效期文案：0 表示永久；缺失时按 0 处理（与原实现 `expiresAt || 0` 一致）。 */
export function licenseExpiryLabel(expiresAt?: number): string {
  if (expiresAt === 0) return "永久有效 (Lifetime)";
  return new Date(expiresAt || 0).toLocaleDateString();
}

/** Pro 授权信息行：授权客户 / 有效期 / 席位配额。 */
export function licenseSummaryLine(payload?: LicensePayload): string {
  return `授权客户：${payload?.customer} (${payload?.email}) · 有效期：${licenseExpiryLabel(
    payload?.expiresAt,
  )} · 席位配额：${payload?.maxSeats || 1} 人`;
}

/** 激活请求体；输入为空（含纯空白）时返回 null，调用方不发起请求。 */
export function buildLicenseActivationPayload(
  input: string,
): { licenseKey: string } | null {
  const key = input.trim();
  if (!key) return null;
  return { licenseKey: key };
}

export type LicenseActivationOutcome =
  | { ok: true; status: LicenseStatus }
  | { ok: false; message: string };

/** 解析 POST /api/admin/license 的响应：仅当 HTTP 成功且 isPro 为真时视为激活成功。 */
export function parseLicenseActivationResult(
  resOk: boolean,
  data: unknown,
): LicenseActivationOutcome {
  const d = (data ?? {}) as LicenseStatus;
  if (resOk && d.isPro) return { ok: true, status: d };
  return { ok: false, message: `❌ 激活失败：${d.error || "许可证无效"}` };
}

// ═══════════════════════════════════════════════════════════════
// S3 / WebDAV 云存储与异地还原
// ═══════════════════════════════════════════════════════════════

/** 云存储配置初值（字段与默认值与原内联 useState 逐字一致）。 */
export const DEFAULT_CLOUD_STORAGE_CONFIG: CloudStorageConfig = {
  enabled: false,
  type: "none",
  s3Endpoint: "",
  s3Region: "us-east-1",
  s3Bucket: "",
  s3AccessKey: "",
  s3SecretKey: "",
  s3PathPrefix: "navelix-backups/",
  s3ForcePathStyle: false,
  webdavUrl: "",
  webdavUsername: "",
  webdavPassword: "",
  autoBackupDaily: true,
  keepCopies: 7,
};

/** 解析 GET /api/admin/storage 的响应（敏感字段已由服务端掩码）；非对象响应视为无效。 */
export function parseStorageConfig(
  data: unknown,
): Partial<CloudStorageConfig> | null {
  if (!data || typeof data !== "object") return null;
  return data as Partial<CloudStorageConfig>;
}

/** 切换存储类型：type 随所选卡片，enabled 由「是否关闭云备份」推导。 */
export function storageTypePatch(
  config: CloudStorageConfig,
  type: string,
): CloudStorageConfig {
  return { ...config, type: type as StorageType, enabled: type !== "none" };
}

/** POST /api/admin/storage 保存结果的提示文案。 */
export function storageSaveMessage(resOk: boolean, data: unknown): string {
  // 与原实现一致：直接取字段，响应体为 null 时同样抛错并落入调用方的 catch
  const d = data as { message?: string; error?: string };
  if (resOk) return d.message || "云存储配置保存成功！";
  return `❌ 保存失败: ${d.error}`;
}

/** PUT action=test 连通性测试的提示文案。 */
export function storageTestMessage(resOk: boolean, data: unknown): string {
  const d = data as { success?: boolean; message?: string; error?: string };
  if (resOk && d.success) return d.message || "🎉 连接测试成功！";
  return `❌ 连通性测试失败: ${d.message || d.error}`;
}

/** PUT action=backup_now 立即备份的提示文案。 */
export function storageBackupMessage(resOk: boolean, data: unknown): string {
  const d = data as { success?: boolean; message?: string; error?: string };
  if (resOk && d.success) return d.message || "🎉 成功备份并上传至云存储！";
  return `❌ 备份失败: ${d.error}`;
}

/** 解析 PUT action=list 的响应；backups 非数组时返回 null（原实现不更新列表）。 */
export function parseRemoteBackupList(
  resOk: boolean,
  data: unknown,
): RemoteBackupItem[] | null {
  if (!resOk) return null;
  const backups = (data as { backups?: unknown }).backups;
  return Array.isArray(backups) ? (backups as RemoteBackupItem[]) : null;
}

export type StorageRestoreOutcome =
  | { ok: true }
  | { ok: false; message: string };

/** 解析 PUT action=restore 的响应；成功时调用方弹 alert 并整页刷新。 */
export function parseStorageRestoreResult(
  resOk: boolean,
  data: unknown,
): StorageRestoreOutcome {
  const d = data as { success?: boolean; error?: string };
  if (resOk && d.success) return { ok: true };
  return { ok: false, message: `❌ 还原失败: ${d.error}` };
}

/** 快照体积展示：原实现固定按 KB 保留一位小数。 */
export function formatBackupSize(size: number): string {
  return `${(size / 1024).toFixed(1)} KB`;
}

/** 快照时间展示：跟随运行环境的本地化格式（与原实现一致）。 */
export function formatBackupTime(lastModified: string): string {
  return new Date(lastModified).toLocaleString();
}
