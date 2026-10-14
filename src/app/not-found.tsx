import { useTranslations } from "next-intl";
import Link from "next/link";

export default function NotFound() {
  const tx = useTranslations();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F8FA] px-4 text-center dark:bg-[#151218]">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-strong to-brand text-2xl font-extrabold text-white shadow-lg shadow-brand/25">
        N
      </div>
      <p className="mt-6 text-6xl font-black text-gray-200 dark:text-slate-700">
        404
      </p>
      <h1 className="mt-3 text-lg font-bold text-gray-900 dark:text-white">
        {tx("page_not_found_e75737c1")}</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-slate-400">
        {tx("this_page_may_have_moved_been_deleted_or_the_url_ed192aca")}</p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-gradient-to-r from-brand-strong to-brand px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:shadow-xl hover:brightness-105 active:scale-[0.98]"
      >
        {tx("back_to_home_4cd7e649")}</Link>
    </div>
  );
}