import fs from "node:fs";
import path from "node:path";

export interface AppBuildInfo {
  version: string;
  sourceSha: string | null;
  buildDate: string | null;
  isDockerBuild: boolean;
}

const DEFAULT_VERSION = "2.8.4";

/**
 * 获取系统当前真实构建元数据
 * 优先级：
 * 1. 物理磁盘打包烘焙的 public/build-info.json (免疫 Docker/Watchtower 环境变量继承覆盖)
 * 2. 运行时环境变量 (NAVELIX_SOURCE_SHA, NAVELIX_BUILD_DATE, NAVELIX_VERSION)
 * 3. 默认回退 (package.json 默认版本 1.0.6)
 */
export function getBuildInfo(): AppBuildInfo {
  let fileInfo: Partial<AppBuildInfo> | null = null;

  // 1. 尝试从 public/build-info.json 物理磁盘文件读取
  try {
    const candidates = [
      path.join(process.cwd(), "public", "build-info.json"),
      path.join(process.cwd(), "build-info.json"),
      path.join(process.cwd(), ".next", "build-info.json"),
    ];

    for (const filePath of candidates) {
      if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
        const raw = fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          fileInfo = {
            version: typeof parsed.version === "string" ? parsed.version : undefined,
            sourceSha: typeof parsed.sourceSha === "string" ? parsed.sourceSha : undefined,
            buildDate: typeof parsed.buildDate === "string" ? parsed.buildDate : undefined,
          };
          break;
        }
      }
    }
  } catch {
    // 忽略文件读取异常，回退环境变量
  }

  const envSha = process.env.NAVELIX_SOURCE_SHA?.trim() || "";
  const envDate = process.env.NAVELIX_BUILD_DATE?.trim() || "";
  const envVersion = process.env.NAVELIX_VERSION?.trim() || "";

  const version = fileInfo?.version || envVersion || DEFAULT_VERSION;
  const sourceSha = fileInfo?.sourceSha || (envSha ? envSha : null);
  const buildDate = fileInfo?.buildDate || (envDate ? envDate : null);

  const isDockerBuild = Boolean(
    fileInfo?.sourceSha || fileInfo?.buildDate || envSha || envDate || process.env.NAVELIX_VERSION,
  );

  return {
    version,
    sourceSha,
    buildDate,
    isDockerBuild,
  };
}
