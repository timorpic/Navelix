"use client";

import { useMemo, useState } from "react";
import Sidebar from "@/components/sidebar";
import HeroBanner from "@/components/hero-banner";
import QuickAccess from "@/components/quick-access";
import RightSidebar from "@/components/right-sidebar";
import CardGrid from "@/components/card-grid";
import CategoryColumns from "@/components/category-columns";
import CalendarView from "@/components/calendar-view";
import ProjectsView from "@/components/projects-view";
import DashboardView from "@/components/dashboard-view";
import { useNavelixData } from "@/hooks/use-navelix-data";
import { useNavelixConfig } from "@/hooks/use-navelix-config";
import { useLinkStatus } from "@/hooks/use-link-status";

export default function Home() {
  const { categories, links, hydrated } = useNavelixData();
  const { config } = useNavelixConfig();

  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [notice, setNotice] = useState("");

  const filteredLinks = useMemo(() => {
    let result = links;
    if (activeCategory !== "all") {
      result = result.filter((l) => l.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.url.toLowerCase().includes(q),
      );
    }
    return result;
  }, [links, activeCategory, searchQuery]);

  const { statuses } = useLinkStatus(
    config.linkStatusEnabled ? links : [],
    (config.linkStatusInterval || 60) * 1000,
  );

  const quickAccessLinks = useMemo(() => {
    return links.filter((l) => l.isQuickAccess);
  }, [links]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FA] dark:bg-[#151218] text-sm text-gray-400">
        加载中…
      </div>
    );
  }

  const isFiltering = activeCategory !== "all" || searchQuery.trim().length > 0;

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
    <div className="flex min-h-screen flex-col bg-[#F6F8FA] dark:bg-[#151218] text-gray-900 dark:text-slate-100 font-sans antialiased lg:flex-row">
      {/* 1. Left Sidebar */}
      <Sidebar
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
      />

      {/* 2. Center Workspace Main Area */}
      <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className={`${maxWidthClass} mx-auto flex flex-col gap-6 transition-all duration-300`}>
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

          {/* Top Hero Banner */}
          <HeroBanner
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          {activeCategory === "feature-calendar" ? (
            <CalendarView />
          ) : activeCategory === "feature-projects" ? (
            <ProjectsView />
          ) : activeCategory === "feature-dashboard" ? (
            <DashboardView categories={categories} links={links} config={config} />
          ) : isFiltering ? (
            /* Search / Category Filtered View */
            <div className="flex flex-col gap-4 mt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  {activeCategory === "all"
                    ? `搜索结果 ("${searchQuery}")`
                    : categories.find((c) => c.id === activeCategory)?.name ||
                      "分类书签"}
                </h2>
                <button
                  onClick={() => {
                    setActiveCategory("all");
                    setSearchQuery("");
                  }}
                  className="text-xs text-[#00C776] hover:underline cursor-pointer"
                >
                  清除筛选
                </button>
              </div>
              <CardGrid links={filteredLinks} statuses={statuses} />
            </div>
          ) : (
            /* Standard Dashboard View */
            <>
              {/* Quick Access Section */}
              <QuickAccess links={quickAccessLinks} />

              {/* All Categories & Links Grid */}
              <CategoryColumns
                categories={categories}
                links={links}
                onViewCategory={(catId: string) => setActiveCategory(catId)}
              />
            </>
          )}
        </div>
      </main>

      {/* 3. Right Sidebar Dashboard */}
      <RightSidebar />
    </div>
  );
}
