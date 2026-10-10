"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Modal from "./modal";
import ClockWeatherWidget from "./clock-weather-widget";
import LogoMark from "./logo-mark";
import BrandLogoText from "./brand-logo-text";
import { useNavelixConfig, useNavelixData } from "@/context/navelix-context";
import { DEFAULT_CUSTOM_FOOTER } from "@/lib/constants";
import { resolveAvatar } from "@/lib/avatars";
import { clearCachedUserData } from "./navelix-provider";
import TeamCategoriesModal from "./team-categories-modal";
import Toast from "./toast";
import type { Category } from "@/types";
import { copyShareLink } from "@/lib/share-link";
import { useToast } from "@/hooks/use-toast";

interface SidebarProps {
  categories: Category[];
  activeCategory: string;
  onSelectCategory: (id: string) => void;
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({
  categories,
  activeCategory,
  onSelectCategory,
  collapsed = false,
  onToggle,
}: SidebarProps) {
  const router = useRouter();
  const { config, updateConfig, isDark } = useNavelixConfig();
  const { user } = useNavelixData();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 仅用于挂载后启用过渡动画；秒级时钟已随 ClockWeatherWidget 一并迁出
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  // 2. Modals & Menu State
  const [showProfileModal, setShowProfileModal] = useState(false);
  const { notice, flash } = useToast();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Current User details state — 从 user prop 派生，无需额外 effect
  const currentUser = useMemo(() => user ? {
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    avatar: user.avatar,
    email: user.email,
    bio: user.bio,
  } : null, [user]);

  const [bottomOpen, setBottomOpen] = useState(true);

  const handleToggleDarkMode = () => {
    const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
    const idx = order.indexOf(config.theme);
    const next = order[(idx + 1) % order.length];
    updateConfig({ theme: next });
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    // 清除上一个账号的 localStorage 用户数据缓存，防止下一位登录者看到旧数据
    clearCachedUserData();
    router.push("/login");
    router.refresh();
  };

  const [teamModalOpen, setTeamModalOpen] = useState(false);

  // Dynamic navigation items generated directly from categories prop
  const dynamicNavItems = [
    {
      id: "all",
      name: "首页总览",
      icon: "🏠",
      isSubscribed: false,
      isTeamShared: false,
      ownerName: undefined as string | undefined,
    },
    ...categories.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon || "📌",
      isSubscribed: Boolean(c.isSubscribed),
      isTeamShared: Boolean(c.isTeamShared),
      ownerName: c.ownerName,
    })),
  ];

  const workspaceTools = [
    { id: "feature-calendar", name: "日历日程", icon: "📅" },
    { id: "feature-projects", name: "项目管理", icon: "🗂️" },
    { id: "feature-dashboard", name: "数据看板", icon: "📈" },
    { id: "feature-activities", name: "消息通知", icon: "🔔" },
  ];

  return (
    <>
      <Toast message={notice} variant="toast" />
      {/* Mobile Top Bar */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="打开导航菜单"
            className="p-2 -ml-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <LogoMark size="sm" />
            <span className="text-sm font-bold tracking-tight text-gray-900 dark:text-white truncate">
              <BrandLogoText text={config.logoText} />
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleDarkMode}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={config.theme === "system" ? "跟随系统" : isDark ? "切换至浅色模式" : "切换至深色模式"}
          >
            {config.theme === "system" ? (
              <svg className="w-4 h-4 text-[#00C776]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
              </svg>
            ) : isDark ? (
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
          <Link
            href="/admin"
            className="px-3 py-1.5 rounded-lg bg-[#00C776] text-white text-xs font-semibold transition-colors hover:bg-[#009a5a]"
          >
            ⚙️ 后台
          </Link>
        </div>
      </div>

      {/* Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 ${
          collapsed ? "w-16 px-2 py-4" : "w-60 p-5"
        } shrink-0 flex flex-col justify-between border-r select-none overflow-x-hidden ${
          mounted ? "transition-all duration-300 ease-in-out" : "transition-none"
        } lg:static lg:z-auto lg:translate-x-0 lg:h-screen lg:sticky lg:top-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } text-gray-900 dark:text-slate-100 ${
          config.glassmorphism
            ? "backdrop-blur-xl bg-white/75 dark:bg-slate-900/80 border-white/40 dark:border-slate-700/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_16px_rgba(0,0,0,0.06)]"
            : "bg-white border-gray-100 dark:bg-slate-900 dark:border-slate-800"
        }`}
      >
        {/* Top Section - 填满剩余空间，让底部抽屉固定在最低端 */}
        <div className="flex-1 min-h-0 flex flex-col gap-6">
          {/* Brand Logo & Theme Toggle */}
          <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between px-2"} w-full`}>
            <div className="flex items-center gap-3 min-w-0">
              <LogoMark size={collapsed ? "sm" : "md"} />
              {!collapsed && (
                <span className="text-lg font-bold tracking-tight truncate text-gray-900 dark:text-white">
                  <BrandLogoText text={config.logoText} />
                </span>
              )}
            </div>

            {!collapsed && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={handleToggleDarkMode}
                  className="p-1.5 rounded-xl transition-colors cursor-pointer hover:bg-gray-100 text-gray-600 dark:bg-slate-800/80 dark:text-amber-400 dark:hover:bg-slate-700 shrink-0 border border-transparent dark:border-slate-700/60"
                  title={config.theme === "system" ? "跟随系统" : isDark ? "切换至浅色模式" : "切换至深色模式"}
                >
                  {config.theme === "system" ? (
                    <svg className="w-4 h-4 text-[#00C776]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                    </svg>
                  ) : isDark ? (
                    <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Main Navigation Menu - 在品牌与底部抽屉之间滚动 */}
          <nav className="flex-1 min-h-0 flex flex-col gap-1.5 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {!collapsed && (
              <div className="px-3.5 mb-1 text-[10px] font-bold tracking-wider text-gray-400 dark:text-slate-500 uppercase">
                分类书签
              </div>
            )}
            {dynamicNavItems.map((item) => {
              const isSelected = activeCategory === item.id;

              return (
                <div
                  key={item.id}
                  className="group relative flex items-center justify-center w-full"
                >
                  <button
                    onClick={() => {
                      onSelectCategory(item.id);
                      setMobileOpen(false);
                    }}
                    title={item.name}
                    className={`flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer ${
                      collapsed
                        ? "w-10 h-10 text-base shrink-0"
                        : "flex-1 gap-3.5 px-3.5 py-2.5 text-xs font-semibold justify-start"
                    } ${
                      isSelected
                        ? "bg-[#00C776] text-white shadow-sm shadow-[#00C776]/20"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {!collapsed && (
                      <div className="flex items-center gap-1.5 min-w-0 pr-6">
                        <span className="truncate">{item.name}</span>
                        {item.isSubscribed && (
                          <span
                            title={item.ownerName ? `来自 @${item.ownerName}` : "团队共享"}
                            className="text-[9px] px-1 py-0.2 rounded font-bold bg-teal-500/20 text-teal-700 dark:text-teal-300"
                          >
                            团队
                          </span>
                        )}
                      </div>
                    )}
                  </button>

                  {!collapsed && item.id !== "all" && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const r = await copyShareLink("category", item.id, item.name);
                        flash(r.message);
                      }}
                      title="复制免登录分享链接"
                      className={`absolute right-2 p-1 rounded-md text-xs transition-opacity ${
                        isSelected
                          ? "text-white/80 hover:text-white hover:bg-white/20"
                          : "text-gray-400 hover:text-[#00C776] hover:bg-gray-200/60 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      🔗
                    </button>
                  )}
                </div>
              );
            })}

            {!collapsed && (
              <button
                onClick={() => setTeamModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 mt-1 rounded-xl text-[11px] font-medium text-gray-500 hover:text-[#00C776] hover:bg-[#00C776]/10 dark:text-slate-400 dark:hover:text-[#00C776] transition-colors cursor-pointer"
              >
                <span>👥</span>
                <span>+ 订阅团队分类</span>
              </button>
            )}

            {/* 工作空间应用扩展：日历日程、项目管理、数据看板 */}
            {!collapsed && (
              <div className="px-3.5 mt-4 mb-1 text-[10px] font-bold tracking-wider text-gray-400 dark:text-slate-500 uppercase">
                工作空间
              </div>
            )}
            {workspaceTools.map((tool) => {
              const isSelected = activeCategory === tool.id;

              return (
                <div key={tool.id} className="flex items-center justify-center w-full">
                  <button
                    key={tool.id}
                    onClick={() => {
                      onSelectCategory(tool.id);
                      setMobileOpen(false);
                    }}
                    title={tool.name}
                    className={`flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer ${
                      collapsed
                        ? "w-10 h-10 text-base shrink-0"
                        : "flex-1 gap-3.5 px-3.5 py-2.5 text-xs font-semibold justify-start"
                    } ${
                      isSelected
                        ? "bg-[#00C776] text-white shadow-sm shadow-[#00C776]/20"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    }`}
                  >
                    <span className="shrink-0">{tool.icon}</span>
                    {!collapsed && <span className="truncate">{tool.name}</span>}
                  </button>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section 抽屉 */}
        {!collapsed && (
        <div className="relative flex flex-col pt-4 border-t border-gray-100 dark:border-slate-800">
          {/* 抽屉切换按钮 */}
          <button
            onClick={() => setBottomOpen(!bottomOpen)}
            className="flex items-center justify-center gap-1.5 mb-3 text-[10px] font-medium text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors cursor-pointer select-none"
          >
            <svg
              className={`w-3 h-3 transition-transform duration-200 ${bottomOpen ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
            <span>{bottomOpen ? "收起工具" : "展开工具"}</span>
          </button>

          {/* 可折叠内容 */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              bottomOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="flex flex-col gap-4">
              {/* 时钟 / 天气 切换卡片（已拆为独立组件） */}
              <ClockWeatherWidget />
            </div>
          </div>

          {/* User Profile Card (始终置底，菜单向上浮出不被截断) */}
          <div className="relative mt-3" ref={userMenuRef}>
            {/* User Popover Drawer Menu */}
            {showUserMenu && (
              <div className="absolute bottom-full mb-2 left-0 right-0 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-1.5 z-50 animate-fadeIn flex flex-col gap-1 text-xs font-semibold text-gray-700 dark:text-slate-200">
                <Link
                  href="/admin"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <span>⚙️</span>
                  <span>后台管理</span>
                </Link>
                <div className="my-0.5 border-t border-gray-100 dark:border-slate-700" />
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-left transition-colors cursor-pointer w-full"
                >
                  <span>🚪</span>
                  <span>退出当前登录</span>
                </button>
              </div>
            )}

            <div
              onClick={() => setShowUserMenu((prev) => !prev)}
              className="flex items-center justify-between p-2.5 rounded-xl border transition-colors cursor-pointer group bg-gray-50/80 hover:bg-gray-50 border-gray-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:border-slate-700 select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00C776] to-[#009a5a] flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden shadow-2xs">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 头像可能是任意图片地址或 data URL */}
                  <img
                    src={resolveAvatar(currentUser?.avatar, currentUser?.username)}
                    alt={currentUser?.displayName || "用户"}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold truncate text-gray-900 dark:text-white">
                    {currentUser?.displayName || "用户"}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-slate-400 truncate">
                    {currentUser?.bio || (currentUser?.role === "admin"
                      ? "👑 管理员"
                      : "构建 · 设计 · AI · 技术")}
                  </span>
                </div>
              </div>
              <svg className={`w-3.5 h-3.5 text-gray-400 dark:text-slate-500 group-hover:text-gray-700 dark:group-hover:text-slate-300 transition-transform duration-200 shrink-0 ${showUserMenu ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
              </svg>
            </div>
          </div>

          {/* Custom Footer Copyright + 收起按钮 */}
          <div className="flex items-center justify-between px-1 mt-2">
            <p className="text-[10px] text-gray-400 dark:text-slate-400 truncate">
              {config.customFooter || DEFAULT_CUSTOM_FOOTER}
            </p>
            <button
              onClick={onToggle}
              className="p-1 rounded-md transition-colors cursor-pointer text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 shrink-0"
              title={collapsed ? "展开侧边栏" : "收起侧边栏"}
            >
              <svg
                className="w-3.5 h-3.5 transition-transform duration-300"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>
        )}
        {/* 收起时底部展开按钮 */}
        {collapsed && (
          <div className="flex items-center justify-center pt-3 border-t border-gray-100 dark:border-slate-800 w-full">
            <button
              onClick={onToggle}
              className="w-10 h-10 flex items-center justify-center rounded-xl transition-colors cursor-pointer text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800 shrink-0"
              title="展开侧边栏"
            >
              <svg
                className="w-4 h-4"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </aside>

      {/* Profile Center Modal (我的信息) */}
      <Modal
        open={showProfileModal}
        title="我的信息与个人中心"
        onClose={() => setShowProfileModal(false)}
      >
        <div className="flex flex-col items-center p-3 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00C776] to-[#009a5a] flex items-center justify-center text-white text-2xl font-bold shadow-md overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- 头像可能是任意图片地址或 data URL */}
            <img
              src={resolveAvatar(currentUser?.avatar, currentUser?.username)}
              alt={currentUser?.displayName || "用户"}
              className="w-full h-full object-cover"
            />
          </div>

          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {currentUser?.displayName || "用户"}
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-400">
              账号: <span className="font-mono text-gray-700 dark:text-slate-300">@{currentUser?.username || "admin"}</span>
            </p>
            <div className="mt-1.5 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-600 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-400 dark:border-teal-900">
              {currentUser?.role === "admin" ? "👑 系统管理员 (Admin)" : "👤 普通注册用户"}
            </div>
          </div>

          {/* Detailed Info Grid */}
          <div className="w-full text-left space-y-2.5 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 dark:text-slate-400">当前账号</span>
              <span className="font-bold text-gray-800 dark:text-slate-200">@{currentUser?.username || "admin"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 dark:text-slate-400">显示昵称</span>
              <span className="font-bold text-gray-800 dark:text-slate-200">{currentUser?.displayName || "用户"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 dark:text-slate-400">主题模式</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">
                {config.theme === "system"
                  ? `跟随系统（${isDark ? "深色" : "浅色"}）`
                  : isDark
                  ? "深色模式"
                  : "浅色模式"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 dark:text-slate-400">已登录 Session</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400">Active (已认证)</span>
            </div>
          </div>

          <div className="w-full pt-3 border-t border-gray-100 dark:border-slate-700 flex flex-col gap-2">
            <Link
              href="/admin"
              onClick={() => setShowProfileModal(false)}
              className="w-full h-9 rounded-lg bg-[#00C776] hover:bg-[#009a5a] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              ⚙️ 打开个人后台管理面板
            </Link>

            <button
              onClick={handleLogout}
              className="w-full h-9 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              🚪 退出当前账号登录
            </button>
          </div>
        </div>
      </Modal>

      {/* 团队公开分类订阅大厅 */}
      <TeamCategoriesModal
        isOpen={teamModalOpen}
        onClose={() => setTeamModalOpen(false)}
      />
    </>
  );
}
