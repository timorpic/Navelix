"use client";

import Link from "next/link";
import type { Category } from "@/types";

interface HeaderProps {
  categories: Category[];
  activeCategory: string;
  onSelectCategory: (id: string) => void;
  user: { username: string; displayName: string; role: string } | null;
  onLogout: () => void;
}

export default function Header({
  categories,
  activeCategory,
  onSelectCategory,
  user,
  onLogout,
}: HeaderProps) {
  // 动态导航：基于实际分类数据生成，与数据库保持一致
  const navTabs = [
    { id: "all", label: "总览" },
    ...categories.map((c) => ({ id: c.id, label: c.label || c.name })),
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00C776] to-[#009a5a] flex items-center justify-center text-white font-bold text-sm">
            N
          </div>
          <span className="text-lg font-semibold text-gray-900">Navelix</span>
        </div>

        <nav className="hidden md:flex items-center gap-1">
          {navTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onSelectCategory(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeCategory === tab.id
                  ? "bg-[#00C776]/10 text-[#00C776]"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user?.role === "admin" && (
            <Link
              href="/admin"
              aria-label="Admin"
              title="Admin"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="12" r="1" />
                <circle cx="5" cy="12" r="1" />
              </svg>
            </Link>
          )}
          {user ? (
            <>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#00C776] to-[#009a5a] text-xs font-semibold uppercase text-white">
                {user.displayName.charAt(0) || user.username.charAt(0)}
              </div>
              <button
                onClick={onLogout}
                title="Sign out"
                className="flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="flex h-8 items-center rounded-lg bg-[#00C776] px-3.5 text-xs font-medium text-white transition-colors hover:bg-[#009a5a]"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
