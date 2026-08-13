"use client";

import React from "react";
import { useNavelixConfig } from "@/hooks/use-navelix-config";
import LogoMark from "./logo-mark";
import SearchBar from "./search-bar";

interface HeroBannerProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export default function HeroBanner({
  searchQuery,
  onSearchChange,
}: HeroBannerProps) {
  const { config } = useNavelixConfig();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#EBF9F9] via-[#E6F7F7] to-[#D5F3F3] dark:from-[#1c1920] dark:via-[#252028] dark:to-[#1c1920] p-6 sm:p-8 border border-[#D0F0F0]/60 dark:border-[#00c776]/30 shadow-sm transition-colors">
      {/* Wave / Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#00b4b408_1px,transparent_1px),linear-gradient(to_bottom,#00b4b408_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left Column Content */}
        <div className="flex-1 w-full max-w-xl">
          {/* Greeting */}
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl animate-bounce">👋</span>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              你好，欢迎回来
            </h1>
          </div>

          <p className="text-gray-600 dark:text-slate-300 font-medium text-base mb-1">
            欢迎来到我的数字工作空间
          </p>

          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-400 mb-6">
            AI · 设计 · 开发 · 知识库
          </p>

          {/* Large Search Input (Conditionally rendered by showSearchBar config) */}
          {config.showSearchBar && (
            <div className="mb-4">
              <SearchBar value={searchQuery} onChange={onSearchChange} />
            </div>
          )}
        </div>

        {/* Right Column 3D Glass Cube Artwork */}
        <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
          {/* Glowing platform base */}
          <div className="absolute bottom-2 w-32 h-10 bg-[#00C776]/20 rounded-full blur-xl animate-pulse" />
          <div className="absolute bottom-4 w-28 h-6 bg-[#33d68a]/30 rounded-full blur-md" />

          {/* Pure CSS/SVG 3D Translucent Glass Cube */}
          <div className="relative w-28 h-28 transform rotate-12 -rotate-x-12 transition-transform hover:scale-105 duration-300">
            {/* Front Glass Face */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/70 via-[#33d68a]/40 to-[#00C776]/60 backdrop-blur-md border border-white/80 shadow-lg flex items-center justify-center">
              <LogoMark size="lg" />
            </div>
            {/* Top Glass Face Layer */}
            <div className="absolute -top-3 left-3 right-3 h-6 rounded-t-xl bg-white/50 backdrop-blur-sm border-t border-x border-white/90 transform skew-x-12" />
            {/* Side Glow Effect */}
            <div className="absolute -right-3 top-3 bottom-3 w-6 rounded-r-xl bg-[#00C776]/30 backdrop-blur-sm border-r border-y border-white/60 transform skew-y-12" />
          </div>
        </div>
      </div>
    </div>
  );
}
