"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { useNavelixConfig, useNavelixData } from "@/context/navelix-context";
import SearchBar from "./search-bar";
import LogoMark from "./logo-mark";

interface HeroBannerProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectCategory?: (cat: string) => void;
}

export default function HeroBanner({
  searchQuery,
  onSearchChange,
}: HeroBannerProps) {
  const tx = useTranslations();
  const locale = useLocale();
  const { config } = useNavelixConfig();
  const { user } = useNavelixData();

  // 1. 直接同步使用 SSR / 响应式注入的用户昵称，杜绝任何假名或旧名一闪而过
  const userName = user?.displayName || user?.username || config.logoText || tx("friend_677aad1a");

  // 3. 计算时间与动态问候语
  const { greeting, dateString } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    let greet = tx("hello_670d9743");
    if (hour >= 5 && hour < 12) greet = tx("good_morning_3cc2e31e");
    else if (hour >= 12 && hour < 14) greet = tx("good_afternoon_fceb1962");
    else if (hour >= 14 && hour < 19) greet = tx("good_afternoon_552594ef");
    else greet = tx("good_evening_d8e9a7fa");

    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekdays = [tx("sunday_7e06f314"), tx("monday_56451fdf"), tx("tuesday_8621c00d"), tx("wednesday_23ae0a11"), tx("thursday_478911d2"), tx("friday_6e5969e5"), tx("saturday_7bb2f5ec")];
    const weekday = weekdays[now.getDay()];

    return {
      greeting: greet,
      dateString: locale === "en" ? now.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" }) : tx("message_fc8f0f8cce57", {v0: month, v1: day, v2: weekday}),
    };
  }, [tx, locale]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white/90 dark:bg-slate-900/80 backdrop-blur-md p-5 sm:p-7 border border-gray-200/80 dark:border-slate-800 shadow-2xs transition-colors">
      {/* Background Accent Gradients */}
      <div className="absolute -right-20 -top-20 w-80 h-80 bg-brand/10 dark:bg-brand/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 w-60 h-60 bg-teal-500/10 dark:bg-teal-500/15 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* ── Left / Main Content: 问候语 + 当前状态 + 搜索栏 ── */}
        <div className="flex-1 w-full space-y-3.5">
          <div>
            {/* Greeting Header */}
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="text-2xl animate-bounce">👋</span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                {greeting}，{userName}
              </h1>
            </div>

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

          {/* 搜索栏（如果用户启用了搜索栏配置） */}
          {config.showSearchBar && (
            <div className="pt-2 max-w-xl">
              <SearchBar value={searchQuery} onChange={onSearchChange} />
            </div>
          )}
        </div>

        {/* ── Right Artwork: 3D Translucent Glass Cube ── */}
        <div className="relative w-36 h-36 shrink-0 hidden md:flex items-center justify-center">
          {/* Glowing platform base */}
          <div className="absolute bottom-2 w-28 h-8 bg-brand/20 rounded-full blur-xl animate-pulse" />
          <div className="absolute bottom-3 w-24 h-5 bg-[#33d68a]/30 rounded-full blur-md" />

          {/* Pure CSS/SVG 3D Translucent Glass Cube */}
          <div className="relative w-24 h-24 transform rotate-12 -rotate-x-12 transition-transform hover:scale-105 duration-300">
            {/* Front Glass Face */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/70 via-[#33d68a]/40 to-brand/60 backdrop-blur-md border border-white/80 shadow-lg flex items-center justify-center">
              <LogoMark size="lg" />
            </div>
            {/* Top Glass Face Layer */}
            <div className="absolute -top-2.5 left-2.5 right-2.5 h-5 rounded-t-xl bg-white/50 backdrop-blur-sm border-t border-x border-white/90 transform skew-x-12" />
            {/* Side Glow Effect */}
            <div className="absolute -right-2.5 top-2.5 bottom-2.5 w-5 rounded-r-xl bg-brand/30 backdrop-blur-sm border-r border-y border-white/60 transform skew-y-12" />
          </div>
        </div>
      </div>
    </div>
  );
}
