"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Modal from "./modal";
import LogoMark from "./logo-mark";
import { useNavelixConfig } from "@/hooks/use-navelix-config";
import { resolveAvatar } from "@/lib/avatars";
import { clearCachedUserData } from "./navelix-provider";
import {
  formatRelativeTime,
  type NotificationItem,
} from "@/lib/notifications";
import type { Category } from "@/types";

interface SidebarProps {
  categories: Category[];
  activeCategory: string;
  onSelectCategory: (id: string) => void;
}

export default function Sidebar({
  categories,
  activeCategory,
  onSelectCategory,
}: SidebarProps) {
  const router = useRouter();
  const { config, updateConfig, isDark } = useNavelixConfig();

  // 1. Notifications State（读取后台操作记录）
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [now, setNow] = useState<Date>(() => new Date(0));

  // 首次渲染后立即设置真实时间（避免 hydration mismatch：SSR 和客户端初始值一致）
  useEffect(() => {
    queueMicrotask(() => {
      setNow(new Date());
    });
  }, []);

  // 时钟 / 天气 切换 Widget State
  const [clockTab, setClockTab] = useState<"time" | "weather">("time");
  const [weather, setWeather] = useState<{
    temp: number;
    windSpeed: number;
    desc: string;
    icon: string;
    isDay: boolean;
    location: string;
    updatedAt: string;
  } | null>(null);

  // 2. Modals State
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Current User details state
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    displayName: string;
    role: string;
    avatar?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setCurrentUser(data.user ?? null))
      .catch(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
        }
      })
      .catch(() => {});
  }, []);

  // 实时时钟
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);



  // 获取天气数据（调后端代理 /api/weather，隐藏 API Key 和位置）
  const fetchWeather = useCallback(async () => {
    try {
      const res = await fetch("/api/weather");
      if (!res.ok) {
        setWeather(null);
        return;
      }
      const data = await res.json();
      if (data.enabled === false || data.error) {
        setWeather(null);
        return;
      }
      // 降级状态：API 返回 isFallback 时显示"数据更新中"而非模拟数据
      if (data.isFallback) {
        setWeather({
          temp: NaN,
          windSpeed: 0,
          desc: "数据更新中",
          icon: "🔄",
          isDay: true,
          location: data.location || "实时",
          updatedAt: "",
        });
        return;
      }
      setWeather({
        temp: data.temp || 24,
        windSpeed: data.windSpeed || 12,
        desc: data.desc || "晴",
        icon: "☀️",
        isDay: true,
        location: data.location || "实时",
        updatedAt: data.updatedAt || "",
      });
    } catch {
      setWeather(null);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchWeather();
    });
    const interval = setInterval(fetchWeather, 10 * 60 * 1000); // 每 10 分钟刷新
    return () => clearInterval(interval);
  }, [fetchWeather]);

  const [bottomOpen, setBottomOpen] = useState(true);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showNotifications]);

  const handleToggleDarkMode = () => {
    const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
    const idx = order.indexOf(config.theme);
    const next = order[(idx + 1) % order.length];
    updateConfig({ theme: next });
  };

  const handleToggleNotifications = async () => {
    const nextState = !showNotifications;
    setShowNotifications(nextState);
    if (nextState) {
      try {
        const res = await fetch("/api/notifications");
        const data = await res.json();
        if (Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
        }
      } catch {
        // ignore
      }
      fetch("/api/notifications/read", { method: "POST" }).catch(() => {});
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const handleMarkAllRead = () => {
    fetch("/api/notifications/read", { method: "POST" }).catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    // 清除上一个账号的 localStorage 用户数据缓存，防止下一位登录者看到旧数据
    clearCachedUserData();
    router.push("/login");
    router.refresh();
  };

  // Dynamic navigation items generated directly from categories prop
  const dynamicNavItems = [
    { id: "all", name: "首页总览", icon: "🏠" },
    ...categories.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon || "📌",
    })),
  ];

  const workspaceTools = [
    { id: "feature-calendar", name: "日历日程", icon: "📅" },
    { id: "feature-projects", name: "项目管理", icon: "🗂️" },
    { id: "feature-dashboard", name: "数据看板", icon: "📈" },
  ];

  return (
    <>
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
              Navelix
            </span>
          </div>
        </div>
        <Link
          href="/admin"
          className="px-3 py-1.5 rounded-lg bg-[#00C776] text-white text-xs font-semibold transition-colors hover:bg-[#009a5a]"
        >
          ⚙️ 后台
        </Link>
      </div>

      {/* Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 shrink-0 flex flex-col justify-between border-r p-5 select-none transition-all duration-200 lg:static lg:z-auto lg:translate-x-0 lg:h-screen lg:sticky lg:top-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } bg-white border-gray-100 text-gray-900 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100`}
      >
        {/* Top Section - 填满剩余空间，让底部抽屉固定在最低端 */}
        <div className="flex-1 min-h-0 flex flex-col gap-6">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 px-2">
            <LogoMark size="md" />
            <span className="text-lg font-bold tracking-tight truncate text-gray-900 dark:text-white">
              Navelix
            </span>
          </div>

          {/* Main Navigation Menu - 在品牌与底部抽屉之间滚动 */}
          <nav className="flex-1 min-h-0 flex flex-col gap-1.5 overflow-y-auto pr-1 scrollbar-thin">
            <div className="px-3.5 mb-1 text-[10px] font-bold tracking-wider text-gray-400 dark:text-slate-500 uppercase">
              分类书签
            </div>
            {dynamicNavItems.map((item) => {
              const isSelected = activeCategory === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectCategory(item.id);
                    setMobileOpen(false);
                  }}
                  className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "bg-[#00C776] text-white shadow-sm shadow-[#00C776]/20"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  }`}
                >
                  <span className="text-sm">{item.icon}</span>
                  <span className="truncate">{item.name}</span>
                </button>
              );
            })}

            {/* 工作空间应用扩展：日历日程、项目管理、数据看板 */}
            <div className="px-3.5 mt-4 mb-1 text-[10px] font-bold tracking-wider text-gray-400 dark:text-slate-500 uppercase">
              工作空间
            </div>
            {workspaceTools.map((tool) => {
              const isSelected = activeCategory === tool.id;

              return (
                <button
                  key={tool.id}
                  onClick={() => {
                    onSelectCategory(tool.id);
                    setMobileOpen(false);
                  }}
                  className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "bg-[#00C776] text-white shadow-sm shadow-[#00C776]/20"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  }`}
                >
                  <span className="text-sm">{tool.icon}</span>
                  <span className="truncate">{tool.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section 抽屉 */}
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
              {/* 时钟 / 天气 切换卡片 */}
          <div
            className="px-2 py-1.5 rounded-xl text-center bg-gray-50 text-gray-800 dark:bg-slate-800/60 dark:text-slate-100"
          >
            {/* Tab 切换条 */}
            <div className="flex items-center gap-0.5 mb-1.5 bg-black/5 dark:bg-white/5 rounded-lg p-0.5">
              <button
                onClick={() => setClockTab("time")}
                className={`flex-1 py-0.5 px-1.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  clockTab === "time"
                    ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300"
                }`}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 7 12 12 15 15" />
                </svg>
                <span>时钟</span>
              </button>
              <button
                onClick={() => setClockTab("weather")}
                className={`flex-1 py-0.5 px-1.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  clockTab === "weather"
                    ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300"
                }`}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v2M12 19v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                  <circle cx="12" cy="12" r="5" />
                </svg>
                <span>天气</span>
              </button>
            </div>

            {/* 内容区 */}
            {clockTab === "time" ? (
              <>
                <p suppressHydrationWarning className="text-lg font-bold tabular-nums leading-tight">
                  {now.toLocaleTimeString("zh-CN", { hour12: false })}
                </p>
                <p suppressHydrationWarning className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
                  {now.getMonth() + 1}月{now.getDate()}日{" "}
                  {["周日", "周一", "周二", "周三", "周四", "周五", "周六"][now.getDay()]}
                </p>
              </>
            ) : weather ? (
              <>
                <p className="text-lg font-bold leading-tight flex items-center justify-center gap-1.5">
                  {weather.icon.startsWith("http") ? (
                    /* eslint-disable-next-line @next/next/no-img-element -- 动态天气图标地址 */
                    <img src={weather.icon} alt={weather.desc} className="w-7 h-7" />
                  ) : (
                    <span>{weather.icon}</span>
                  )}
                  {/* 降级状态（temp 为 NaN 时）只显示状态文案，不显示温度 */}
                  <span>{Number.isNaN(weather.temp) ? "" : `${weather.temp}°C`}</span>
                </p>
                <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5 flex items-center justify-center gap-1">
                  <span>{weather.desc}</span>
                  <span>·</span>
                  <span>{weather.location}</span>
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold tabular-nums leading-tight">--°C</p>
                <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
                  未配置天气
                </p>
              </>
            )}
          </div>

          {/* Quick Settings Bar */}
          <div className="flex items-center justify-around px-2 py-1 text-gray-500">
            {/* 1. Theme Toggle */}
            <button
              onClick={handleToggleDarkMode}
              className="p-2 rounded-xl transition-colors cursor-pointer hover:bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-amber-400 dark:hover:bg-slate-700"
              title={config.theme === "system" ? "跟随系统" : isDark ? "切换至浅色模式" : "切换至深色模式"}
            >
              {config.theme === "system" ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                </svg>
              ) : isDark ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {/* 2. Notifications Bell */}
            <button
              onClick={handleToggleNotifications}
              className={`relative p-2 rounded-xl transition-colors cursor-pointer ${
                showNotifications
                  ? "bg-[#00C776]/10 text-[#00C776]"
                  : "hover:bg-gray-100 text-gray-600 dark:hover:bg-slate-800 dark:text-slate-300"
              }`}
              title="消息通知"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              )}
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500" />
              )}
            </button>

          </div>

          {/* Notifications Drawer */}
          {showNotifications && (
            <div
              ref={notifRef}
              className="absolute bottom-16 left-0 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-3 z-50 animate-fadeIn"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-slate-700">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    消息通知
                  </span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 text-[10px] font-bold">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={() => {
                        handleMarkAllRead();
                        setShowNotifications(false);
                      }}
                      className="text-[10px] text-[#00C776] hover:underline cursor-pointer"
                    >
                      全部已读
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="w-5 h-5 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors cursor-pointer text-xs"
                    title="关闭消息"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-[11px] text-gray-400 dark:text-slate-400">
                    暂无操作记录
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-2 rounded-xl text-xs transition-colors ${
                        !n.read
                          ? "bg-teal-50/60 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900"
                          : "bg-gray-50/60 dark:bg-slate-700/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-gray-900 dark:text-white truncate">
                          {n.title}
                        </span>
                        <span className="text-[9px] text-gray-400 shrink-0 ml-2">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-slate-300 leading-snug break-all">
                        {n.content}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* User Profile Card */}
          <div
            onClick={() => setShowProfileModal(true)}
            className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors cursor-pointer group bg-gray-50/80 hover:bg-gray-50 border-gray-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:border-slate-700`}
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
                  {currentUser?.role === "admin"
                    ? "👑 管理员"
                    : "构建 · 设计 · AI · 技术"}
                </span>
              </div>
            </div>
            <svg className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500 group-hover:text-gray-700 dark:group-hover:text-slate-300 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>

          {/* Custom Footer Copyright */}
          <p className="text-[10px] text-gray-400 dark:text-slate-400 text-center px-1 truncate">
            {config.customFooter || "© 2026 Navelix. 保留所有权利。"}
          </p>
            </div>
          </div>
        </div>
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
              className="w-full h-9 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              🚪 退出当前账号登录
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
