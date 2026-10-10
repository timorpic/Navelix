"use client";

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
  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100/90 dark:border-slate-700 shadow-2xs transition-colors">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            分组管理 ({categories.length})
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            添加、修改与删除导航侧边栏的分组列表
          </p>
        </div>
        <button
          onClick={onAddCategory}
          className="h-9 px-4 bg-[#00C776] hover:bg-[#009a5a] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span className="text-sm">+</span>
          <span>添加新分组</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-400 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="pb-3 pr-4">图标</th>
              <th className="pb-3 pr-4">分组名称</th>
              <th className="pb-3 pr-4">分组 ID</th>
              <th className="pb-3 pr-4">包含链接数</th>
              <th className="pb-3 text-right">操作</th>
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
                      {count} 个链接
                    </span>
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
                            if (!res.ok) throw new Error("获取失败");
                            const data = await res.json();
                            await navigator.clipboard.writeText(
                              buildShareUrl(window.location.origin, data.sharePath),
                            );
                            onNotify("免登录分享", `已复制「${c.name}」只读分享链接至剪贴板`);
                          } catch {
                            onNotify("免登录分享", "生成分享链接失败");
                          }
                        }}
                        title="复制免登录只读分享链接"
                        className="text-gray-500 dark:text-slate-400 hover:text-[#00C776] font-medium transition-colors cursor-pointer"
                      >
                        🔗 分享
                      </button>
                      <button
                        onClick={() => onEditCategory(c)}
                        className="text-gray-500 dark:text-slate-400 hover:text-[#00C776] font-medium transition-colors cursor-pointer"
                      >
                        ✏️ 修改
                      </button>
                      <button
                        onClick={() => onDeleteCategory(c)}
                        className="text-gray-400 dark:text-slate-400 hover:text-rose-500 font-medium transition-colors cursor-pointer"
                      >
                        🗑️ 删除
                      </button>
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
