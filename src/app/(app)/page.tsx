"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/sidebar";
import HeroBanner from "@/components/hero-banner";
import QuickAccess from "@/components/quick-access";
import TopStatsBar from "@/components/top-stats-bar";
import RightSidebar from "@/components/right-sidebar";
import CardGrid from "@/components/card-grid";
import WorkspaceOverviewColumns from "@/components/workspace-overview-columns";
import RecentActivitiesCard from "@/components/recent-activities-card";
import GlobalSearchResults from "@/components/global-search-results";
import CalendarView from "@/components/calendar-view";
import ProjectsView from "@/components/projects-view";
import DashboardView from "@/components/dashboard-view";
import { QuickCaptureLayer } from "@/components/quick-capture-layer";
import { useNavelixData } from "@/hooks/use-navelix-data";
import { useNavelixConfig } from "@/hooks/use-navelix-config";
import { useLinkStatus } from "@/hooks/use-link-status";
import SecuritySetupBanner from "@/components/security-setup-banner";

function HomeContent() {
  const { categories, links, hydrated, addLink } = useNavelixData();
  const { config, updateConfig } = useNavelixConfig();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab") || searchParams.get("category");

  // 优先级：用户会话交互点击 > URL 查询参数（SSR 首帧直出） > 默认 "all"
  const [internalCategory, setInternalCategory] = useState<string | null>(null);
  const activeCategory = internalCategory ?? tabFromUrl ?? "all";

  const [searchQuery, setSearchQuery] = useState("");
  const [notice, setNotice] = useState("");

  // 左右侧边栏收起状态：初始均由服务端 SSR Cookie/配置注入，确保首帧 100% 零闪烁与零跳动
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(
    () => config.sidebarDefaultState === "collapsed",
  );
  const [rightCollapsed, setRightCollapsed] = useState<boolean>(
    () => config.sidebarRightDefaultState === "collapsed",
  );

  // 挂载后同步本地设备持久化记忆
  useEffect(() => {
    try {
      const left = localStorage.getItem("navelix_sidebar_left");
      if (left !== null) {
        queueMicrotask(() => setLeftCollapsed(left === "true"));
      }
      const right = localStorage.getItem("navelix_sidebar_right");
      if (right !== null) {
        queueMicrotask(() => setRightCollapsed(right === "true"));
      }
    } catch {
      /* ignore */
    }
  }, []);

  // 监听浏览器前进/后退
  useEffect(() => {
    const handlePopState = () => {
      try {
        const url = new URL(window.location.href);
        const tab = url.searchParams.get("tab") || url.searchParams.get("category") || "all";
        setInternalCategory(tab);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleSelectCategory = (id: string) => {
    setInternalCategory(id);
    try {
      localStorage.setItem("navelix_active_category", id);
      const url = new URL(window.location.href);
      if (id === "all") {
        url.searchParams.delete("tab");
        url.searchParams.delete("category");
      } else {
        url.searchParams.set("tab", id);
      }
      window.history.pushState(null, "", url.toString());
    } catch {
      /* ignore */
    }
  };

  const handleLeftToggle = () => {
    const next = !leftCollapsed;
    setLeftCollapsed(next);
    try {
      localStorage.setItem("navelix_sidebar_left", String(next));
      document.cookie = `navelix_sidebar_left=${next ? "1" : "0"};path=/;max-age=31536000;SameSite=Lax`;
    } catch {
      /* ignore */
    }
    updateConfig({ sidebarDefaultState: next ? "collapsed" : "expanded" });
  };

  const handleRightToggle = () => {
    const next = !rightCollapsed;
    setRightCollapsed(next);
    try {
      localStorage.setItem("navelix_sidebar_right", String(next));
      document.cookie = `navelix_sidebar_right=${next ? "1" : "0"};path=/;max-age=31536000;SameSite=Lax`;
    } catch {
      /* ignore */
    }
    updateConfig({ sidebarRightDefaultState: next ? "collapsed" : "expanded" });
  };

  const filteredLinks = useMemo(() => {
    let result = links;
    if (activeCategory !== "all") {
      result = result.filter((l) => l.category === activeCategory);
    }
    return result;
  }, [links, activeCategory]);

  const handleSearchNavigate = (categoryId: string) => {
    setSearchQuery("");
    handleSelectCategory(categoryId);
  };

  const { statuses } = useLinkStatus(
    config.linkStatusEnabled ? links : [],
    (config.linkStatusInterval || 60) * 1000,
  );

  const quickAccessLinks = useMemo(() => {
    return links.filter((l) => l.isQuickAccess);
  }, [links]);

  const effectiveWallpaperUrl = useMemo(() => {
    if (config.wallpaperMode === "bing") {
      return "https://bing.biturl.top/?resolution=1920&format=image&index=0";
    }
    if (config.wallpaperMode === "custom" && config.customWallpaperUrl) {
      return config.customWallpaperUrl;
    }
    return null;
  }, [config.wallpaperMode, config.customWallpaperUrl]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FA] dark:bg-[#151218] text-sm text-gray-400">
        加载中…
      </div>
    );
  }

  const isFiltering = activeCategory !== "all";

  // Compute container max width dynamically (1200px default)
  const maxWidthClass =
    config.maxWidth === "1000px"
      ? "max-w-[1000px]"
      : config.maxWidth === "1400px"
      ? "max-w-[1400px]"
      : config.maxWidth === "full"
      ? "max-w-full"
      : "max-w-[1200px]";

  return (
    <div className="relative flex min-h-screen flex-col bg-[#F6F8FA] dark:bg-[#151218] text-gray-900 dark:text-slate-100 font-sans antialiased lg:flex-row">
      {/* 动态全屏背景壁纸 */}
      {effectiveWallpaperUrl && (
        <div
          className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat transition-all duration-700 opacity-85"
          style={{ backgroundImage: `url(${effectiveWallpaperUrl})` }}
        >
          <div className="absolute inset-0 bg-black/20 dark:bg-black/50 backdrop-blur-[2px]" />
        </div>
      )}

      {/* 1. Left Sidebar */}
      <Sidebar
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={handleSelectCategory}
        collapsed={leftCollapsed}
        onToggle={handleLeftToggle}
      />

      {/* 2. Center Workspace Main Area */}
      <main className="relative z-10 flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-6">
        <div className={`${maxWidthClass} mx-auto flex flex-col gap-3.5`}>
          {notice && (
            <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-800 animate-fadeIn shadow-2xs">
              <div className="flex items-center gap-2">
                <span>🔒</span>
                <span>{notice}</span>
              </div>
              <button
                onClick={() => setNotice("")}
                className="text-amber-500 hover:text-amber-700"
              >
                ✕
              </button>
            </div>
          )}

          {/* 首次登录安全设置引导横幅（仅管理员且未完成时展示） */}
          <SecuritySetupBanner />

          {/* Feature Pages (日历日程、项目管理、数据看板、消息通知等独立全景页面不展示 HeroBanner) */}
          {activeCategory === "feature-calendar" ? (
            <CalendarView />
          ) : activeCategory === "feature-projects" ? (
            <ProjectsView />
          ) : activeCategory === "feature-dashboard" ? (
            <DashboardView
              categories={categories}
              links={links}
              config={config}
              statuses={statuses}
            />
          ) : activeCategory === "feature-activities" ? (
            <RecentActivitiesCard links={links} />
          ) : (
            <>
              {/* Top Hero Banner 仅在主工作台与书签视图展示 */}
              <HeroBanner
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSelectCategory={handleSelectCategory}
              />

              {searchQuery.trim() ? (
                /* 全系统搜索结果显示页 */
                <GlobalSearchResults
                  query={searchQuery}
                  onNavigate={handleSearchNavigate}
                  onClear={() => setSearchQuery("")}
                />
              ) : isFiltering ? (
                /* Category Filtered View */
                <div className="flex flex-col gap-4 mt-2">
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl p-4 shadow-2xs">
                    <div className="flex items-center gap-3">
                      <h2 className="text-base font-bold text-gray-900 dark:text-white">
                        {categories.find((c) => c.id === activeCategory)?.name || "分类书签"}
                      </h2>
                      <span className="text-xs px-2.5 py-0.5 rounded-md bg-[#00C776]/10 text-[#00C776] font-medium">
                        {filteredLinks.length} 个书签
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch("/api/share/token", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ type: "category", id: activeCategory }),
                            });
                            if (!res.ok) throw new Error("获取失败");
                            const data = await res.json();
                            await navigator.clipboard.writeText(`${window.location.origin}${data.sharePath}`);
                            alert(`已复制「${categories.find((c) => c.id === activeCategory)?.name || "当前分类"}」免登录分享链接至剪贴板！可以直接发送给朋友或同事查看。`);
                          } catch {
                            alert("生成分享链接失败");
                          }
                        }}
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:border-[#00C776] hover:text-[#00C776] dark:hover:border-[#00C776] transition-colors cursor-pointer"
                        title="复制该分类的免登录公开分享链接"
                      >
                        <span>🔗</span>
                        <span>分享此分类</span>
                      </button>
                      <button
                        onClick={() => {
                          handleSelectCategory("all");
                          setSearchQuery("");
                        }}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 px-2 py-1 cursor-pointer"
                      >
                        返回总览
                      </button>
                    </div>
                  </div>
                  <CardGrid links={filteredLinks} statuses={statuses} />
                </div>
              ) : (
                /* Standard Dashboard View */
                <>
                  {/* 顶部五卡片：今日专注、待办任务、知识笔记、项目进度、快速操作 */}
                  <TopStatsBar
                    categories={categories}
                    links={links}
                    onSelectCategory={handleSelectCategory}
                  />

                  {/* Quick Access Section */}
                  <QuickAccess links={quickAccessLinks} />

                  {/* 首页工作空间概览：项目概览、日程概览 */}
                  <WorkspaceOverviewColumns
                    categories={categories}
                    links={links}
                    onSelectCategory={handleSelectCategory}
                  />
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* 3. Right Sidebar Dashboard */}
      <RightSidebar
        collapsed={rightCollapsed}
        onToggle={handleRightToggle}
      />

      {/* 4. 自定义 CSS 与统计探针代码注入 */}
      {config.customCss && (
        <style dangerouslySetInnerHTML={{ __html: config.customCss }} />
      )}
      {config.customHeadScripts && (
        <div
          style={{ display: "none" }}
          dangerouslySetInnerHTML={{ __html: config.customHeadScripts }}
        />
      )}

      {/* PWA 快速采集层（?action=quick-add-bookmark 等） */}
      <QuickCaptureLayer categories={categories} onAdd={addLink} />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
