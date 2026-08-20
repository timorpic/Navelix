import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F8FA] px-4 text-center dark:bg-[#151218]">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#009a5a] to-[#00C776] text-2xl font-extrabold text-white shadow-lg shadow-[#00C776]/25">
        N
      </div>
      <p className="mt-6 text-6xl font-black text-gray-200 dark:text-slate-700">
        404
      </p>
      <h1 className="mt-3 text-lg font-bold text-gray-900 dark:text-white">
        页面不存在
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-slate-400">
        你访问的页面可能已被移动、删除，或链接地址有误。
      </p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-gradient-to-r from-[#009a5a] to-[#00C776] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#00C776]/25 transition-all hover:shadow-xl hover:brightness-105 active:scale-[0.98]"
      >
        ← 返回首页
      </Link>
    </div>
  );
}