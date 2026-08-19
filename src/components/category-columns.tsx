"use client";

import BrandIcon from "./brand-icon";
import type { Category, SiteLink } from "@/types";
import { recordLinkUsage } from "@/lib/link-usage";

interface CategoryColumnsProps {
  categories: Category[];
  links: SiteLink[];
  onViewCategory?: (catId: string) => void;
}

export default function CategoryColumns({
  categories,
  links,
  onViewCategory,
}: CategoryColumnsProps) {
  // 展示用户创建的所有分类卡片
  const displayCategories = categories;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 my-6">
      {displayCategories.map((cat) => {
        const catLinks = links.filter((l) => l.category === cat.id);

        return (
          <div
            key={cat.id}
            className="flex flex-col bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-gray-100/90 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-colors duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-50 dark:border-slate-700/60">
              <div className="flex items-center gap-2">
                <span className="text-base">{cat.icon || "📌"}</span>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {cat.name}
                </h3>
              </div>
              <button
                className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-md transition-colors"
                title="更多选项"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>
            </div>

            {/* Links List */}
            <div className="flex flex-col gap-2 flex-1">
              {catLinks.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => recordLinkUsage(item.id)}
                  className="group flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50/80 dark:hover:bg-slate-700/60 transition-all duration-150 cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-slate-900 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <BrandIcon name={item.icon || item.title} className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-gray-800 dark:text-slate-100 group-hover:text-[#00C776] transition-colors">
                      {item.title}
                    </p>
                    <p className="truncate text-[10px] text-gray-400 dark:text-slate-400">
                      {item.description || item.url.replace(/^https?:\/\//, "")}
                    </p>
                  </div>
                </a>
              ))}
              {catLinks.length === 0 && (
                <div className="flex-1 flex items-center justify-center py-6 text-[11px] text-gray-400 dark:text-slate-500">
                  暂无相关书签链接
                </div>
              )}
            </div>

            {/* View All Footer Link */}
            <div className="mt-3 pt-2 border-t border-gray-50 dark:border-slate-700/60">
              <button
                onClick={() => onViewCategory && onViewCategory(cat.id)}
                className="flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-slate-400 hover:text-[#00C776] transition-colors cursor-pointer"
              >
                <span>查看全部 ({links.filter((l) => l.category === cat.id).length})</span>
                <span className="text-sm">→</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
