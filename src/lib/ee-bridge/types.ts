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
