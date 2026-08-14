"use client";

import React from "react";

interface BrandIconProps {
  name: string;
  className?: string;
}

export default function BrandIcon({ name, className = "w-5 h-5" }: BrandIconProps) {
  const iconLower = name.toLowerCase();

  // 支持本地上传的 data URL 与 Iconify/任意 http(s) 图标地址
  if (name.startsWith("data:") || /^https?:\/\//i.test(name)) {
    return (
      <div
        className={`flex items-center justify-center overflow-hidden ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 动态图片地址，可能为 data URL，无法使用 next/image */}
        <img
          src={name}
          alt=""
          className="w-full h-full object-contain"
          draggable={false}
        />
      </div>
    );
  }

  switch (iconLower) {
    case "chatgpt":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-[#10a37f] text-white p-1 ${className}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
            <path d="M12 6v12M6 12h12" />
          </svg>
        </div>
      );
    case "claude":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-[#d97757] text-white font-serif font-bold text-xs p-1 ${className}`}>
          ✳
        </div>
      );
    case "notion":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-black text-white font-bold text-xs p-1 ${className}`}>
          N
        </div>
      );
    case "github":
    case "github-cat":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-[#181717] text-white p-1 ${className}`}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </div>
      );
    case "figma":
    case "figma-cat":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-[#0ACF83]/10 p-1 ${className}`}>
          <svg viewBox="0 0 38 57" fill="none" className="w-full h-full">
            <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38H19V28.5Z" fill="#1ABCFE"/>
            <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83"/>
            <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262"/>
            <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E"/>
            <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" fill="#A259FF"/>
          </svg>
        </div>
      );
    case "iconpark":
    case "iconpark-cat":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 text-white p-1 ${className}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
            <circle cx="6.5" cy="17.5" r="3.5" />
          </svg>
        </div>
      );
    case "iconfont":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-[#1890FF] text-white p-1 ${className}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
      );
    case "tabler":
    case "tabler-icons":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-[#0054A6] text-white p-1 ${className}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
            <path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" />
            <path d="M9 12l2 2l4 -4" />
          </svg>
        </div>
      );
    case "google":
    case "material-symbols":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-white border border-gray-100 shadow-xs p-1 ${className}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full text-blue-500">
            <path d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M18.364 5.636L5.636 18.364" />
          </svg>
        </div>
      );
    case "iconoir":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-slate-900 text-white p-1 ${className}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 3" />
          </svg>
        </div>
      );
    case "qingicon":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-[#00C776] text-white p-1 ${className}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </div>
      );
    case "vercel":
    case "vercel-cat":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-black text-white p-1 ${className}`}>
          <svg viewBox="0 0 1155 1000" fill="currentColor" className="w-3/5 h-3/5">
            <path d="M577.5 0L1155 1000H0L577.5 0Z" />
          </svg>
        </div>
      );
    case "gmail":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-white border border-gray-100 shadow-sm p-1 ${className}`}>
          <svg viewBox="0 0 24 24" className="w-full h-full">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
        </div>
      );
    case "openai":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-[#10a37f] text-white p-1 ${className}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v8M8 12h8" />
          </svg>
        </div>
      );
    case "midjourney":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-[#000000] text-[#00C776] p-1 ${className}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
            <path d="M3 17l6-6 4 4 8-8" />
          </svg>
        </div>
      );
    case "perplexity":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-[#22B8CF] text-white font-bold text-xs p-1 ${className}`}>
          P
        </div>
      );
    case "runway":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-[#7952B3] text-white font-bold text-xs p-1 ${className}`}>
          R
        </div>
      );
    case "dribbble":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-[#EA4C89] text-white p-1 ${className}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
            <circle cx="12" cy="12" r="9" />
            <path d="M3.6 9h16.8M3.6 15h16.8" />
          </svg>
        </div>
      );
    case "behance":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-[#1769FF] text-white font-bold text-xs p-1 ${className}`}>
          Bē
        </div>
      );
    case "iconify":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-gray-800 text-white font-bold text-xs p-1 ${className}`}>
          I
        </div>
      );
    case "mdn":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-black text-white font-bold text-[10px] p-1 ${className}`}>
          MDN
        </div>
      );
    case "stackoverflow":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-[#F48024] text-white p-1 ${className}`}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
            <path d="M17.36 20.2v-5.46h2.23V22.4H3.81v-7.66h2.23v5.46h11.32zm-8.87-3.8h8.55v-2.12H8.49v2.12zm.45-5.63l8.03 2.92.74-2.03-8.03-2.92-.74 2.03zm1.96-5.32l6.81 5.2.13-2.22-6.8-5.2-.14 2.22zm4.18-5.36L10.3 3.9l4.5 7.4 1.88-1.15-4.5-7.4z" />
          </svg>
        </div>
      );
    case "youtube":
      return (
        <div className={`flex items-center justify-center rounded-lg bg-[#FF0000] text-white p-1 ${className}`}>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </div>
      );
    default:
      return (
        <div className={`flex items-center justify-center rounded-lg bg-gradient-to-br from-[#00C776] to-[#009a5a] text-white font-bold text-xs p-1 ${className}`}>
          {name.slice(0, 1).toUpperCase()}
        </div>
      );
  }
}
