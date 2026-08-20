import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyShareToken, getSharedCategoryData, getSharedProjectData } from "@/lib/share";

interface SharePageProps {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: SharePageProps): Promise<Metadata> {
  const { type, id } = await params;
  const { token } = await searchParams;

  if (!token) return { title: "Navelix · 访问分享" };

  const verification = verifyShareToken(token);
  if (!verification.valid || !verification.payload) {
    return { title: "分享已失效 · Navelix" };
  }

  if (type === "category") {
    const data = getSharedCategoryData(id, verification.payload.userId);
    if (data) {
      return {
        title: `${data.category.name} · ${data.ownerName} 的 Navelix 分享`,
        description: `来自 ${data.ownerName} 分享的「${data.category.name}」精选书签集合，共 ${data.links.length} 个站点。`,
      };
    }
  }

  if (type === "project") {
    const data = getSharedProjectData(id, verification.payload.userId);
    if (data) {
      return {
        title: `${data.project.name} · ${data.ownerName} 的项目看板`,
        description: `来自 ${data.ownerName} 分享的「${data.project.name}」项目进度看板。`,
      };
    }
  }

  return { title: "Navelix · 共享工作台" };
}

export default async function SharePage({ params, searchParams }: SharePageProps) {
  const { type, id } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 text-xl">
            🔒
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">需要访问凭证</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
            该内容属于受保护的分享，请确认您打开了包含完整分享 Token 的链接。
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-[#00C776] hover:bg-[#00b368] transition-colors"
          >
            前往登录
          </Link>
        </div>
      </div>
    );
  }

  const verification = verifyShareToken(token);
  if (!verification.valid || !verification.payload) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 text-xl">
            ⚠️
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {verification.error || "分享链接已失效"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
            该分享可能已过期、被作者取消或链接参数不完整。
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 transition-colors"
          >
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  if (type === "category") {
    const data = getSharedCategoryData(id, verification.payload.userId);
    if (!data) notFound();

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 flex flex-col">
        {/* Header */}
        <header className="border-b border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{data.category.icon || "📁"}</span>
              <div>
                <h1 className="font-semibold text-gray-900 dark:text-white text-base leading-tight">
                  {data.category.name}
                </h1>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  由 <span className="font-medium text-gray-700 dark:text-slate-300">{data.ownerName}</span> 分享 · 共 {data.links.length} 个书签
                </p>
              </div>
            </div>
            <Link
              href="/"
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 transition-colors"
            >
              Navelix 导航
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
          {data.links.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl">
              <p className="text-gray-400 dark:text-slate-500 text-sm">该分类下暂无书签</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {data.links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex items-start gap-3 p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl hover:border-[#00C776] dark:hover:border-[#00C776] shadow-sm hover:shadow transition-all"
                >
                  <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden text-sm">
                    {link.icon && link.icon.startsWith("http") ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={link.icon} alt="" className="w-6 h-6 object-contain" />
                    ) : (
                      <span>{link.icon || "🔗"}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-[#00C776] transition-colors">
                      {link.title}
                    </h2>
                    {link.description && (
                      <p className="text-xs text-gray-400 dark:text-slate-400 line-clamp-2 mt-0.5">
                        {link.description}
                      </p>
                    )}
                    <span className="text-[11px] text-gray-400 dark:text-slate-500 truncate block mt-1">
                      {new URL(link.url).hostname}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 dark:border-slate-800 py-6 text-center text-xs text-gray-400 dark:text-slate-500">
          Powered by Navelix · 个人数字工作台
        </footer>
      </div>
    );
  }

  if (type === "project") {
    const data = getSharedProjectData(id, verification.payload.userId);
    if (!data) notFound();

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 flex flex-col">
        <header className="border-b border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div>
              <h1 className="font-semibold text-gray-900 dark:text-white text-base leading-tight">
                {data.project.name}
              </h1>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                由 <span className="font-medium text-gray-700 dark:text-slate-300">{data.ownerName}</span> 分享的项目看板
              </p>
            </div>
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                backgroundColor: data.project.statusColor ? `${data.project.statusColor}20` : "rgba(0,199,118,0.15)",
                color: data.project.statusColor || "#00C776",
              }}
            >
              {data.project.status}
            </span>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold mb-4">项目基本信息</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-800">
                <span className="text-gray-500 dark:text-slate-400">项目名称</span>
                <span className="font-medium text-gray-900 dark:text-white">{data.project.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-800">
                <span className="text-gray-500 dark:text-slate-400">当前阶段</span>
                <span className="font-medium">{data.project.status}</span>
              </div>
              {data.project.url && (
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-800">
                  <span className="text-gray-500 dark:text-slate-400">关联链接</span>
                  <a
                    href={data.project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#00C776] hover:underline"
                  >
                    {data.project.url}
                  </a>
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="border-t border-gray-200 dark:border-slate-800 py-6 text-center text-xs text-gray-400 dark:text-slate-500">
          Powered by Navelix · 个人数字工作台
        </footer>
      </div>
    );
  }

  notFound();
}
