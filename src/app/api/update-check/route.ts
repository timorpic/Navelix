import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

const DEFAULT_GITHUB_REPO = "timorpic/Navelix";
const DEFAULT_IMAGE_REPO = "timorpic/navelix";
const CACHE_MS = 10 * 60 * 1000;

interface UpdateCheckResult {
  local: {
    sourceSha: string | null;
    buildDate: string | null;
    version: string | null;
    isDockerBuild: boolean;
  };
  remote: {
    digest: string | null;
    lastUpdated: string | null;
    versionTag: string | null;
    releaseNotes?: string | null;
    htmlUrl?: string | null;
  } | null;
  updateAvailable: boolean | null;
  error: string | null;
}

let cache: { data: UpdateCheckResult; expiresAt: number } | null = null;

/** 解析语义化版本 v1.0.42 → [1, 0, 42]，非法返回 null */
function parseVersion(v: string): number[] | null {
  const m = v.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

/** 版本号 a > b ？ */
function versionGt(a: number[], b: number[]): boolean {
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

// GET /api/update-check - 借鉴 Sun-Panel 架构：精准语义化 SemVer 与 SHA 匹配
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const githubRepo = process.env.NAVELIX_GITHUB_REPO?.trim() || DEFAULT_GITHUB_REPO;
  const imageRepo = process.env.NAVELIX_IMAGE_REPO?.trim() || DEFAULT_IMAGE_REPO;
  const sourceSha = process.env.NAVELIX_SOURCE_SHA || "";
  const buildDate = process.env.NAVELIX_BUILD_DATE || "";
  const localVersion = process.env.NAVELIX_VERSION || "";

  const local: UpdateCheckResult["local"] = {
    sourceSha: sourceSha || null,
    buildDate: buildDate || null,
    version: localVersion || null,
    isDockerBuild: Boolean(sourceSha || buildDate || localVersion),
  };

  if (cache && cache.expiresAt > Date.now()) {
    return NextResponse.json({ ...cache.data, local });
  }

  // 1. 查询 GitHub Releases API（只在存在比本地更高 SemVer 的正式 Release 时返回）
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
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

    if (ghRes.ok) {
      const ghData = await ghRes.json();
      const remoteTagName = ghData.tag_name || ghData.name || "";
      const remoteParsed = parseVersion(remoteTagName);
      const localParsed = parseVersion(localVersion);

      // 只有当远程 GitHub 存在更高版本的正式 SemVer Tag（如 v1.1.0 > v1.0.0）时，才触发 GitHub 更新
      if (remoteParsed && localParsed && versionGt(remoteParsed, localParsed)) {
        const ghResult: UpdateCheckResult = {
          local,
          remote: {
            digest: null,
            lastUpdated: ghData.published_at || ghData.created_at || null,
            versionTag: remoteTagName,
            releaseNotes: ghData.body || null,
            htmlUrl: ghData.html_url || null,
          },
          updateAvailable: true,
          error: null,
        };
        cache = { data: ghResult, expiresAt: Date.now() + CACHE_MS };
        return NextResponse.json(ghResult);
      }
    }
  } catch {
    // 静默回退到 Docker Hub 规则判定
  }

  // 2. 查询 Docker Hub Tags API 列表（精准筛选最新的 sha-xxx 标签与 semver 标签）
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const dhRes = await fetch(
      `https://hub.docker.com/v2/repositories/${imageRepo}/tags?page_size=50`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      }
    );
    clearTimeout(timer);

    if (!dhRes.ok) {
      const data: UpdateCheckResult = {
        local,
        remote: null,
        updateAvailable: null,
        error: `查询失败（HTTP ${dhRes.status}）`,
      };
      cache = { data, expiresAt: Date.now() + 60 * 1000 };
      return NextResponse.json(data);
    }

    const body = await dhRes.json();
    const tags: Array<{ name: string; last_updated: string; digest: string }> =
      body.results || [];

    let remoteSemver: string | null = null;
    let remoteSemverParsed: number[] | null = null;
    let remoteSemverUpdated: string | null = null;
    let remoteLatestTag: { name: string; last_updated: string; digest: string } | null = null;

    // 筛选最高语义化版本号
    for (const t of tags) {
      const p = parseVersion(t.name);
      if (p && (!remoteSemverParsed || versionGt(p, remoteSemverParsed))) {
        remoteSemver = t.name;
        remoteSemverParsed = p;
        remoteSemverUpdated = t.last_updated || null;
      }
      if (t.name === "latest") {
        remoteLatestTag = t;
      }
    }

    // 按 last_updated 降序排序所有 sha- 标签，提取云端最新推送到 Docker Hub 的 sha- 标签
    const shaTags = tags
      .filter((t) => t.name.startsWith("sha-"))
      .sort((a, b) => Date.parse(b.last_updated) - Date.parse(a.last_updated));
    const latestShaTag = shaTags[0] || null;

    let updateAvailable = false;
    let remoteVersionTag: string | null = null;
    let remoteLastUpdated: string | null = null;

    const localParsed = parseVersion(localVersion);

    if (localParsed && remoteSemverParsed) {
      // 本地是语义化正式版 (如 v1.0.0) ➔ 对比远程最高语义化版本
      updateAvailable = versionGt(remoteSemverParsed, localParsed);
      remoteVersionTag = remoteSemver;
      remoteLastUpdated = remoteSemverUpdated;
    } else if (localVersion.startsWith("sha-")) {
      // 本地是日常 SHA 构建 (如 sha-7fb2200) ➔ 对比远程最新的 SHA 标签名
      if (latestShaTag) {
        updateAvailable = latestShaTag.name !== localVersion;
        remoteVersionTag = latestShaTag.name;
        remoteLastUpdated = latestShaTag.last_updated;
      } else {
        updateAvailable = false;
        remoteVersionTag = localVersion;
      }
    } else {
      updateAvailable = false;
      remoteVersionTag = remoteSemver || remoteLatestTag?.name || "latest";
      remoteLastUpdated = remoteSemverUpdated || remoteLatestTag?.last_updated || null;
    }

    const data: UpdateCheckResult = {
      local,
      remote: {
        digest: latestShaTag?.digest || remoteLatestTag?.digest || null,
        lastUpdated: remoteLastUpdated,
        versionTag: remoteVersionTag,
      },
      updateAvailable,
      error: null,
    };
    cache = { data, expiresAt: Date.now() + CACHE_MS };
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      local,
      remote: null,
      updateAvailable: null,
      error: "无法连接版本检测服务器",
    });
  }
}