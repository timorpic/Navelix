"use client";

import { useTranslations } from "next-intl";
import { buildShareUrl } from "@/lib/admin-links";
import type { Category, SiteLink } from "@/types";

/**
 * 「链接管理」Tab 的卡片 2：🗂️ 分组管理（图标 / 名称 / ID / 链接数表格 + 分享）。
 *
 * 从 `admin-links-tab.tsx`（原 764 行）抽出 —— 分组表格与链接表格互不相关，
 * 此前共用一个 14 个 useState 的组件。本组件只负责渲染；「复制免登录分享链接」
 * 的请求与文案沿用原实现（未改用 `@/lib/share-link`，因其成功/失败文案与
 * 此处不同，改动会变更用户可见文案），提示由 `onNotify` 转发给父级 Toast。
 */
export default function AdminCategoriesTableCard({
  categories,
  links,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onNotify,
}: {
  categories: Category[];
  /** 全量链接，用于统计各分组包含的链接数 */
  links: SiteLink[];
  onAddCategory: () => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (category: Category) => void;
  /** 展示提示并写入通知中心（来自 useToast） */
  onNotify: (title: string, msg: string) => void;
}) {
  const tx = useTranslations();
  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100/90 dark:border-slate-700 shadow-2xs transition-colors">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            {tx("category_management_de2740f2")}{categories.length})
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            {tx("add_edit_and_delete_navigation_categories_92b4da58")}</p>
        </div>
        <button
          onClick={onAddCategory}
          className="h-9 px-4 bg-[#00C776] hover:bg-[#009a5a] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span className="text-sm">+</span>
          <span>{tx("add_category_542ac58a")}</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-400 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="pb-3 pr-4">{tx("icon_0d720eee")}</th>
              <th className="pb-3 pr-4">{tx("category_name_d7e266bd")}</th>
              <th className="pb-3 pr-4">{tx("category_id_4acad7d2")}</th>
              <th className="pb-3 pr-4">{tx("link_count_5695d4d3")}</th>
              <th className="pb-3 text-right">{tx("actions_ed31fbb4")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
            {categories.map((c) => {
              const count = links.filter((l) => l.category === c.id).length;
              return (
                <tr key={c.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="py-3.5 pr-4 text-base">{c.icon}</td>
                  <td className="py-3.5 pr-4 font-bold text-gray-900 dark:text-white">{c.name}</td>
                  <td className="py-3.5 pr-4 font-mono text-gray-400 dark:text-slate-400">{c.id}</td>
                  <td className="py-3.5 pr-4">
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900">
                      {count} {tx("links_68b2c804")}</span>
                  </td>
                  <td className="py-3.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch("/api/share/token", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ type: "category", id: c.id }),
                            });
                            if (!res.ok) throw new Error(tx("failed_to_fetch_29b3a1b5"));
                            const data = await res.json();
                            await navigator.clipboard.writeText(
                              buildShareUrl(window.location.origin, data.sharePath),
                            );
                            onNotify(tx("share_without_login_8a60b7e5"), tx("message_f27004e334b9", {v0: c.name}));
                          } catch {
                            onNotify(tx("share_without_login_8a60b7e5"), tx("failed_to_generate_share_link_598c0cd3"));
                          }
                        }}
                        title={tx("copy_a_read_only_share_link_that_requires_no_log_70d94a21")}
                        className="text-gray-500 dark:text-slate-400 hover:text-[#00C776] font-medium transition-colors cursor-pointer"
                      >
                        {tx("share_2dab5ef7")}</button>
                      <button
                        onClick={() => onEditCategory(c)}
                        className="text-gray-500 dark:text-slate-400 hover:text-[#00C776] font-medium transition-colors cursor-pointer"
                      >
                        {tx("edit_a2e86c4b")}</button>
                      <button
                        onClick={() => onDeleteCategory(c)}
                        className="text-gray-400 dark:text-slate-400 hover:text-rose-500 font-medium transition-colors cursor-pointer"
                      >
                        {tx("delete_a6c5bde8")}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
