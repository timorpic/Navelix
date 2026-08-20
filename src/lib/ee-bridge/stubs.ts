import type { IStorageProviderDriver, ILinkProbeDriver, ProbeResult } from "./types.ts";
import type { CloudStorageConfig, RemoteBackupItem } from "../storage-provider.ts";

export const CE_PRO_MESSAGE =
  "当前运行环境为从源码自行构建的版本，未包含官方核心驱动。如需使用 S3/WebDAV 异地容灾备份与网络实时延迟探针等 Pro 功能，请直接拉取部署官方 Docker 镜像（docker pull timorpic/navelix:latest）并在后台输入许可证激活。";

export class NullStorageDriver implements IStorageProviderDriver {
  async testConnection(cfg: CloudStorageConfig): Promise<{ success: boolean; message: string }> {
    void cfg;
    return {
      success: false,
      message: CE_PRO_MESSAGE,
    };
  }

  async uploadBackup(
    cfg: CloudStorageConfig,
    localFilePath: string,
    fileName: string,
  ): Promise<{ success: boolean; error?: string }> {
    void cfg;
    void localFilePath;
    void fileName;
    return {
      success: false,
      error: CE_PRO_MESSAGE,
    };
  }

  async listBackups(cfg: CloudStorageConfig): Promise<RemoteBackupItem[]> {
    void cfg;
    return [];
  }

  async downloadBackup(
    cfg: CloudStorageConfig,
    fileName: string,
    targetLocalPath: string,
  ): Promise<{ success: boolean; error?: string }> {
    void cfg;
    void fileName;
    void targetLocalPath;
    return {
      success: false,
      error: CE_PRO_MESSAGE,
    };
  }
}

export class NullLinkProbeDriver implements ILinkProbeDriver {
  async probeUrl(url: string): Promise<ProbeResult> {
    return {
      url,
      status: "offline",
      latencyMs: 0,
      statusCode: 403,
    };
  }

  async probeUrls(urls: string[]): Promise<ProbeResult[]> {
    return urls.map((url) => ({
      url,
      status: "offline",
      latencyMs: 0,
      statusCode: 403,
    }));
  }
}
