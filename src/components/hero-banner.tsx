"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, type ReactNode } from "react";
import { useNavelixConfig } from "@/context/navelix-context";
import SearchBar from "./search-bar";
import LogoMark from "./logo-mark";

interface HeroBannerProps {
  actions?: ReactNode;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export default function HeroBanner({
  actions,
  searchQuery,
  onSearchChange,
}: HeroBannerProps) {
  const tx = useTranslations();
  const locale = useLocale();
  const { config } = useNavelixConfig();
  const { dateString } = useMemo(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekdays = [tx("sunday_7e06f314"), tx("monday_56451fdf"), tx("tuesday_8621c00d"), tx("wednesday_23ae0a11"), tx("thursday_478911d2"), tx("friday_6e5969e5"), tx("saturday_7bb2f5ec")];
    const weekday = weekdays[now.getDay()];

    return {
      dateString: locale === "en" ? now.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" }) : tx("message_fc8f0f8cce57", {v0: month, v1: day, v2: weekday}),
    };
  }, [tx, locale]);

  return (
    <div className="relative">
      <h1 className="sr-only">{tx("workspace_6fed7e86")}</h1>
      <div className="relative rounded-2xl bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-5 sm:p-7 border border-gray-200/80 dark:border-slate-800 shadow-2xs transition-colors">
        {/* Background Accent Gradients */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-[#00C776]/10 dark:bg-[#00C776]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-60 h-60 bg-teal-500/10 dark:bg-teal-500/15 rounded-full blur-2xl pointer-events-none" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          {/* ── Left / Main Content: 日期 + 当前状态 + 搜索栏 ── */}
          <div className="min-w-0 flex-1 w-full space-y-3.5">
            <div>
              {/* Date Subtitle */}
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-slate-400">
                {dateString}
              </p>
            </div>

            {/* 当前状态 */}
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-xs font-bold text-gray-700 dark:text-slate-300">
                {tx("current_status_82b7cf40")}</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800">
                {tx("ready_to_go_f3aaaeaf")}</span>
            </div>

            {(config.showSearchBar || actions) && (
              <div className="relative z-20 flex flex-wrap items-center gap-3 pt-2">
                {config.showSearchBar && (
                  <div className="min-w-0 max-w-xl basis-64 flex-1">
                    <SearchBar value={searchQuery} onChange={onSearchChange} />
                  </div>
                )}
                {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
              </div>
            )}
          </div>

          {/* ── Right Artwork: 3D Translucent Glass Cube ── */}
          <div className="relative w-36 h-36 shrink-0 hidden md:flex items-center justify-center">
            {/* Glowing platform base */}
            <div className="absolute bottom-2 w-28 h-8 bg-[#00C776]/20 rounded-full blur-xl animate-pulse" />
            <div className="absolute bottom-3 w-24 h-5 bg-[#33d68a]/30 rounded-full blur-md" />

            {/* Pure CSS/SVG 3D Translucent Glass Cube */}
            <div className="relative w-24 h-24 transform rotate-12 -rotate-x-12 transition-transform hover:scale-105 duration-300">
              {/* Front Glass Face */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/70 via-[#33d68a]/40 to-[#00C776]/60 backdrop-blur-md border border-white/80 shadow-lg flex items-center justify-center">
                <LogoMark size="lg" />
              </div>
              {/* Top Glass Face Layer */}
              <div className="absolute -top-2.5 left-2.5 right-2.5 h-5 rounded-t-xl bg-white/50 backdrop-blur-sm border-t border-x border-white/90 transform skew-x-12" />
              {/* Side Glow Effect */}
              <div className="absolute -right-2.5 top-2.5 bottom-2.5 w-5 rounded-r-xl bg-[#00C776]/30 backdrop-blur-sm border-r border-y border-white/60 transform skew-y-12" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
