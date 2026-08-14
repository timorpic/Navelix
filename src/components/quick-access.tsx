"use client";

import React from "react";
import BrandIcon from "./brand-icon";
import type { SiteLink } from "@/types";
import { recordLinkUsage } from "@/lib/link-usage";
import { useNavelixConfig } from "@/hooks/use-navelix-config";

interface QuickAccessProps {
  links: SiteLink[];
}

export default function QuickAccess({ links }: QuickAccessProps) {
  const { config } = useNavelixConfig();
  const target = config.linkOpenTarget === "_self" ? "_self" : "_blank";

  if (!links || links.length === 0) {
    return null;
  }

  const cardStyle = config.glassmorphism
    ? "backdrop-blur-md bg-white/70 dark:bg-slate-800/70 border-white/40 dark:border-slate-700/60 shadow-xs hover:shadow-lg"
    : "bg-white dark:bg-slate-800/90 border-gray-100/90 dark:border-slate-700 shadow-2xs hover:shadow-md";

  return (
    <div className="my-3 sm:my-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-amber-500 font-bold">⚡</span>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            快捷访问
          </h2>
          <span className="text-xs text-gray-400 dark:text-slate-400 font-normal">
            ({links.length} 个置顶网址)
          </span>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {links.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target={target}
            rel="noopener noreferrer"
            onClick={() => recordLinkUsage(item.id)}
            className={`group flex flex-col items-center justify-center p-3.5 rounded-xl border hover:border-[#00C776]/30 transition-all duration-200 cursor-pointer ${cardStyle}`}
          >
            <div className="relative mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 dark:bg-slate-900 group-hover:scale-110 transition-transform">
              <BrandIcon name={item.icon || item.title} className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1 max-w-full">
              <span className="truncate text-xs font-semibold text-gray-800 dark:text-slate-100 group-hover:text-[#00C776] transition-colors">
                {item.title}
              </span>
            </div>
            <span className="truncate text-[10px] text-gray-400 dark:text-slate-400 mt-0.5 max-w-full">
              {item.description || item.url.replace(/^https?:\/\//, "")}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
