"use client";

import { useEffect, useRef } from "react";
import { trackClientEvent } from "@/lib/client-analytics";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function SearchBar({ value, onChange, className = "" }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K 聚焦，Esc 清空搜索
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && value) {
        onChange("");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [value, onChange]);

  const handleSubmit = (e: React.FormEvent) => {
    // 搜索仅限系统内，输入即实时展示结果，提交不做外部跳转
    e.preventDefault();
    // 可选遥测：全局搜索（规范 wiki/Analytics §4.1）
    if (value.trim()) {
      trackClientEvent("nav.search");
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`relative w-full ${className}`}>
      <div className="relative flex items-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-xl border border-gray-200/80 dark:border-slate-700 shadow-sm transition-all focus-within:ring-2 focus-within:ring-[#00C776]/40 focus-within:border-[#00C776]">
        <div className="pl-4 pr-2 text-[#00C776] shrink-0">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </div>

        <input
          id="main-search-input"
          ref={inputRef}
          name="search"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="搜索系统内内容..."
          placeholder="搜索书签、日程、项目、消息..."
          className="h-12 w-full bg-transparent pl-2 pr-14 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none"
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="清空搜索"
              title="清空搜索"
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs text-gray-400 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 hover:text-white hover:bg-[#00C776] transition-colors cursor-pointer"
            >
              ✕
            </button>
          )}
          <kbd className="px-2 py-0.5 text-xs font-semibold text-gray-400 dark:text-slate-400 bg-gray-100/80 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-md">
            ⌘ K
          </kbd>
        </div>
      </div>
    </form>
  );
}
