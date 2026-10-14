import { projectStatusLabel } from "@/lib/project-status";
import { getLocale } from "next-intl/server";
import { translateText } from "@/lib/server-translations";
import LanguageSwitcher from "@/components/language-switcher";
import { getTranslations } from "next-intl/server";
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
  const tx = await getTranslations();
  const { type, id } = await params;
  const { token } = await searchParams;

  if (!token) return { title: tx("navelix_shared_content_8057331e") };

  const verification = verifyShareToken(token);
  if (!verification.valid || !verification.payload) {
    return { title: tx("share_expired_navelix_d26147fb") };
  }

  if (type === "category") {
    const data = getSharedCategoryData(id, verification.payload.userId);
    if (data) {
      return {
        title: tx("message_59561ac6092a", {v0: data.category.name, v1: data.ownerName}),
        description: tx("message_f33528750ab0", {v0: data.ownerName, v1: data.category.name, v2: data.links.length}),
      };
    }
  }

  if (type === "project") {
    const data = getSharedProjectData(id, verification.payload.userId);
    if (data) {
      return {
        title: tx("message_778fefc45847", {v0: data.project.name, v1: data.ownerName}),
        description: tx("message_94c3c82b16c3", {v0: data.ownerName, v1: data.project.name}),
      };
    }
  }

  return { title: tx("navelix_shared_workspace_452f80a0") };
}

export default async function SharePage({ params, searchParams }: SharePageProps) {
  const tx = await getTranslations();
  const { type, id } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="relative min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="absolute top-3 right-3"><LanguageSwitcher /></div>
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 text-xl">
            🔒
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{tx("access_token_required_ab083f92")}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
            {tx("this_share_is_protected_open_the_complete_link_i_24eccaf3")}</p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-brand hover:bg-[#00b368] transition-colors"
          >
            {tx("go_to_sign_in_99232cdd")}</Link>
        </div>
      </div>
    );
  }

  const verification = verifyShareToken(token);
  if (!verification.valid || !verification.payload) {
    return (
      <div className="relative min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="absolute top-3 right-3"><LanguageSwitcher /></div>
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 text-xl">
            ⚠️
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {verification.error || tx("share_link_expired_7d3cadc3")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
            {tx("this_share_may_have_expired_been_revoked_or_have_a4929465")}</p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 transition-colors"
          >
            {tx("back_to_home_d66f4359")}</Link>
        </div>
      </div>
    );
  }

  if (type === "category") {
    const data = getSharedCategoryData(id, verification.payload.userId);
    if (!data) notFound();

    return (
      <div className="relative min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 flex flex-col">
        <div className="absolute top-3 right-3"><LanguageSwitcher /></div>
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
                  {tx("shared_by_708712e5")}<span className="font-medium text-gray-700 dark:text-slate-300">{data.ownerName}</span> {tx("total_b9e107b4")}{data.links.length} {tx("bookmarks_d85aebef")}</p>
              </div>
            </div>
            <Link
              href="/"
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 transition-colors"
            >
              {tx("navelix_bookmarks_b43e93c9")}</Link>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
          {data.links.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl">
              <p className="text-gray-400 dark:text-slate-500 text-sm">{tx("no_bookmarks_in_this_category_e5568bfb")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {data.links.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex items-start gap-3 p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl hover:border-brand dark:hover:border-brand shadow-sm hover:shadow transition-all"
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
                    <h2 className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-brand transition-colors">
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
          {tx("powered_by_navelix_personal_digital_workspace_74f602c1")}</footer>
      </div>
    );
  }

  if (type === "project") {
    const data = getSharedProjectData(id, verification.payload.userId);
    if (!data) notFound();

    return (
      <div className="relative min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 flex flex-col">
        <div className="absolute top-3 right-3"><LanguageSwitcher /></div>
        <header className="border-b border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div>
              <h1 className="font-semibold text-gray-900 dark:text-white text-base leading-tight">
                {data.project.name}
              </h1>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {tx("shared_by_708712e5")}<span className="font-medium text-gray-700 dark:text-slate-300">{data.ownerName}</span> {tx("shared_project_board_74d75152")}</p>
            </div>
            <span
              className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                backgroundColor: data.project.statusColor ? `${data.project.statusColor}20` : "rgba(0,199,118,0.15)",
                color: data.project.statusColor || "#00C776",
              }}
            >
              {translateText(await getLocale(), projectStatusLabel(data.project.status))}
            </span>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold mb-4">{tx("project_information_2dadb715")}</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-800">
                <span className="text-gray-500 dark:text-slate-400">{tx("project_name_867698fb")}</span>
                <span className="font-medium text-gray-900 dark:text-white">{data.project.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-800">
                <span className="text-gray-500 dark:text-slate-400">{tx("current_stage_30b7a5d7")}</span>
                <span className="font-medium">{translateText(await getLocale(), projectStatusLabel(data.project.status))}</span>
              </div>
              {data.project.url && (
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-slate-800">
                  <span className="text-gray-500 dark:text-slate-400">{tx("related_links_b0a1e7a4")}</span>
                  <a
                    href={data.project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand hover:underline"
                  >
                    {data.project.url}
                  </a>
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="border-t border-gray-200 dark:border-slate-800 py-6 text-center text-xs text-gray-400 dark:text-slate-500">
          {tx("powered_by_navelix_personal_digital_workspace_74f602c1")}</footer>
      </div>
    );
  }

  notFound();
}
