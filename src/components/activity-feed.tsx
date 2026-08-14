"use client";

import React, { useEffect, useState, useCallback } from "react";
import type { SiteLink } from "@/types";

interface ActivityItem {
  id: string;
  type: "link" | "todo" | "system";
  text: string;
  icon: string;
  ts: number;
}

function formatAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = 60_000,
    hour = 60 * min,
    day = 24 * hour;
  if (diff < min) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / min)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

export default function ActivityFeed({
  links,
  onSelectCategory,
}: {
  links: SiteLink[];
  onSelectCategory?: (id: string) => void;
}) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      // 1. 后台通知与系统操作记录
      const notifRes = await fetch("/api/notifications");
      const notifData = await notifRes.json();
      const notifs: ActivityItem[] = (notifData.notifications || []).map(
        (n: {
          id: string;
          title: string;
          content: string;
          createdAt: number;
        }) => ({
          id: `n-${n.id}`,
          type: "system" as const,
          text: n.content || n.title,
          icon: n.title.includes("🐳")
            ? "🐳"
            : n.title.includes("💾")
            ? "💾"
            : "🔔",
          ts: n.createdAt,
        }),
      );

      // 2. 链接点击（localStorage）
      const linkActivities: ActivityItem[] = [];
      try {
        const raw = localStorage.getItem("navelix.link.usage");
        const usage: Record<string, { count: number; lastUsed: number }> = raw
          ? JSON.parse(raw)
          : {};
        for (const [id, u] of Object.entries(usage)) {
          const link = links.find((l) => l.id === id);
          if (link) {
            linkActivities.push({
              id: `l-${id}`,
              type: "link",
              text: `访问 ${link.title}`,
              icon: link.icon || "🔗",
              ts: u.lastUsed,
            });
          }
        }
      } catch {
        // ignore
      }

      // 3. 合并排序（最近 20 条）
      const merged = [...notifs, ...linkActivities]
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 20);
      setItems(merged);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [links]);

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
    const handle = () => load();
    window.addEventListener("navelix-link-clicked", handle);
    return () => window.removeEventListener("navelix-link-clicked", handle);
  }, [load]);

  const handleNavigateToNotifications = () => {
    if (onSelectCategory) {
      onSelectCategory("feature-activities");
    }
    window.dispatchEvent(
      new CustomEvent("navelix-navigate", { detail: "feature-activities" }),
    );
  };

  return (
    <div className="flex flex-col bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 shadow-2xs transition-colors">
      {/* 头部标题与查看所有链接 */}
      <div className="flex items-center justify-between gap-1.5 mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm">⚡</span>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
            最近活动快速预览
          </h3>
        </div>
        <button
          type="button"
          onClick={handleNavigateToNotifications}
          className="text-[11px] font-semibold text-[#00C776] hover:underline flex items-center gap-0.5 shrink-0 cursor-pointer"
          title="跳转到消息通知与动态页面"
        >
          <span>查看所有</span>
          <span>→</span>
        </button>
      </div>

      {loading ? (
        <p className="py-4 text-center text-[11px] text-gray-400 dark:text-slate-400">
          加载中…
        </p>
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-[11px] text-gray-400 dark:text-slate-400">
          暂无活动记录
        </p>
      ) : (
        <div className="relative pl-3 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-gray-100 dark:before:bg-slate-700">
          {items.slice(0, 7).map((item) => (
            <div key={item.id} className="flex items-center gap-2.5 py-1.5 relative">
              <span className="w-2 h-2 rounded-full bg-gray-200 dark:bg-slate-600 shrink-0 -ml-[5px] ring-2 ring-white dark:ring-slate-800 z-10" />
              {item.icon &&
              (item.icon.startsWith("data:") ||
                item.icon.startsWith("http://") ||
                item.icon.startsWith("https://") ||
                item.icon.startsWith("/")) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.icon}
                  alt=""
                  className="w-3.5 h-3.5 object-contain rounded shrink-0"
                />
              ) : (
                <span className="text-[10px] shrink-0">{item.icon || "📌"}</span>
              )}
              <span className="flex-1 text-[11px] text-gray-600 dark:text-slate-300 truncate">
                {item.text}
              </span>
              <span className="text-[9px] text-gray-400 dark:text-slate-500 shrink-0">
                {formatAgo(item.ts)}
              </span>
            </div>
          ))}

        </div>
      )}
    </div>
  );
}