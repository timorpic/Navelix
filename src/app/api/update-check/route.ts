import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getBuildInfo } from "@/lib/build-info";

const DEFAULT_GITHUB_REPO = "timorpic/Navelix";
const CACHE_MS = 5 * 60 * 1000; // 5 分钟缓存

interface UpdateCheckResult {
  local: {
    sourceSha: string | null;
    buildDate: string | null;
    version: string | null;
    isDockerBuild: boolean;
  };
  remote: {
    versionTag: string | null;
    title: string | null;
    lastUpdated: string | null;
    releaseNotes?: string | null;
    htmlUrl?: string | null;
  } | null;
  updateAvailable: boolean | null;
  error: string | null;
}

let cache: { data: UpdateCheckResult; expiresAt: number } | null = null;

/** 解析语义化版本 v1.0.42 → [1, 0, 42]，非法返回 null */
function parseVersion(v: string): number[] | null {
  if (!v) return null;
  const cleaned = v.trim().replace(/^v/i, "");
  const m = cleaned.match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  return [
    parseInt(m[1], 10),
    parseInt(m[2], 10),
    m[3] ? parseInt(m[3], 10) : 0,
  ];
}

/** 版本号 a > b ？ */
function versionGt(a: number[], b: number[]): boolean {
  for (let i = 0; i < 3; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (ai !== bi) return ai > bi;
  }
  return false;
}

// GET /api/update-check - 依据 GitHub Releases 纯官方发布源自检版本
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const githubRepo = process.env.NAVELIX_GITHUB_REPO?.trim() || DEFAULT_GITHUB_REPO;
  const buildInfo = getBuildInfo();

  const local: UpdateCheckResult["local"] = {
    sourceSha: buildInfo.sourceSha,
    buildDate: buildInfo.buildDate,
    version: buildInfo.version,
    isDockerBuild: buildInfo.isDockerBuild,
  };

  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json({ ...cache.data, local });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const ghRes = await fetch(
      `https://api.github.com/repos/${githubRepo}/releases/latest`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Navelix-Update-Checker",
        },
        cache: "no-store",
      }
    );
    clearTimeout(timer);

    if (ghRes.status === 404) {
      // 仓库尚无正式 Release
      const data: UpdateCheckResult = {
        local,
        remote: null,
        updateAvailable: false,
        error: null,
      };
      cache = { data, expiresAt: Date.now() + CACHE_MS };
      return NextResponse.json(data);
    }

    if (!ghRes.ok) {
      const data: UpdateCheckResult = {
        local,
        remote: null,
        updateAvailable: null,
        error: `GitHub API 请求失败 (HTTP ${ghRes.status})`,
      };
      cache = { data, expiresAt: Date.now() + 60 * 1000 };
      return NextResponse.json(data);
    }

    const ghData = await ghRes.json();
    const remoteTagName = String(ghData.tag_name || ghData.name || "").trim();
    const remoteTitle = String(ghData.name || remoteTagName).trim();
    const remotePublishedAt = ghData.published_at || ghData.created_at || null;
    const releaseNotes = typeof ghData.body === "string" ? ghData.body : null;
    const htmlUrl = typeof ghData.html_url === "string" ? ghData.html_url : null;

    const remoteParsed = parseVersion(remoteTagName);
    const localVersionStr = buildInfo.version || "1.0.0";
    const localParsed = parseVersion(localVersionStr);

    let updateAvailable = false;
    if (remoteParsed && localParsed) {
      updateAvailable = versionGt(remoteParsed, localParsed);
    } else if (remoteTagName && localVersionStr) {
      updateAvailable = remoteTagName.toLowerCase() !== localVersionStr.toLowerCase();
    }

    const result: UpdateCheckResult = {
      local,
      remote: {
        versionTag: remoteTagName,
        title: remoteTitle,
        lastUpdated: remotePublishedAt,
        releaseNotes,
        htmlUrl,
      },
      updateAvailable,
      error: null,
    };

    cache = { data: result, expiresAt: Date.now() + CACHE_MS };
    return NextResponse.json(result);
  } catch (err: unknown) {
    const isAbort = (err as { name?: string })?.name === "AbortError";
    return NextResponse.json({
      local,
      remote: null,
      updateAvailable: null,
      error: isAbort ? "连接 GitHub 超时，请检查网络" : "无法连接 GitHub Releases 版本检测服务",
    });
  }
}