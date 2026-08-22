import type { CloudStorageConfig, RemoteBackupItem } from "../storage-provider.ts";

export interface IStorageProviderDriver {
  testConnection(cfg: CloudStorageConfig): Promise<{ success: boolean; message: string }>;
  uploadBackup(
    cfg: CloudStorageConfig,
    localFilePath: string,
    fileName: string,
  ): Promise<{ success: boolean; error?: string }>;
  listBackups(cfg: CloudStorageConfig): Promise<RemoteBackupItem[]>;
  downloadBackup(
    cfg: CloudStorageConfig,
    fileName: string,
    targetLocalPath: string,
  ): Promise<{ success: boolean; error?: string }>;
}

export interface ProbeResult {
  url: string;
  status: "online" | "slow" | "offline";
  latencyMs: number;
  statusCode?: number;
}

export interface ILinkProbeDriver {
  probeUrl(url: string): Promise<ProbeResult>;
  probeUrls(urls: string[]): Promise<ProbeResult[]>;
}

/**
 * 遥测敏感配置（端点 + 鉴权 TOKEN）。
 * 仅由 ee 字节码制品（ee/dist/bundle.jsc）提供，源码不推送 GitHub。
 * 注意：此配置对**所有实例**（CE/Pro）可用，不依赖激活码——遥测上报应全量运行。
 */
export interface TelemetrySecret {
  endpoint: string;
  token: string;
}
