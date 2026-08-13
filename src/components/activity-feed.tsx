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
  const min = 60_000, hour = 60 * min, day = 24 * hour;
  if (diff < min) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / min)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

export default function ActivityFeed({ links }: { links: SiteLink[] }) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      // 1. 后台通知
      const notifRes = await fetch("/api/notifications");
      const notifData = await notifRes.json();
      const notifs: ActivityItem[] = (notifData.notifications || []).map((n: { id: string; title: string; content: string; createdAt: number }) => ({
        id: `n-${n.id}`,
        type: "system" as const,
        text: n.content || n.title,
        icon: "🔔",
        ts: n.createdAt,
      }));

      // 2. 链接点击（localStorage）
      const linkActivities: ActivityItem[] = [];
      try {
        const raw = localStorage.getItem("navelix.link.usage");
        const usage: Record<string, { count: number; lastUsed: number }> = raw ? JSON.parse(raw) : {};
        for (const [id, u] of Object.entries(usage)) {
          const link = links.find((l) => l.id === id);
          if (link) {
            linkActivities.push({
              id: `l-${id}`,
              type: "link",
              text: `访问 ${link.title}`,
              icon: "🔗",
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

  return (
    <div className="flex flex-col bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 shadow-2xs transition-colors">
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-sm">⚡</span>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">最近活动</h3>
      </div>

      {loading ? (
        <p className="py-4 text-center text-[11px] text-gray-400 dark:text-slate-400">加载中…</p>
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-[11px] text-gray-400 dark:text-slate-400">
          暂无活动记录
        </p>
      ) : (
        <div className="relative pl-3 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-gray-100 dark:before:bg-slate-700">
          {items.slice(0, 7).map((item) => (
            <div key={item.id} className="flex items-center gap-2.5 py-1.5 relative">
              <span className="w-2 h-2 rounded-full bg-gray-200 dark:bg-slate-600 shrink-0 -ml-[5px] ring-2 ring-white dark:ring-slate-800 z-10" />
              <span className="text-[10px]">{item.icon}</span>
              <span className="flex-1 text-[11px] text-gray-600 dark:text-slate-300 truncate">
                {item.text}
              </span>
              <span className="text-[9px] text-gray-400 dark:text-slate-500 shrink-0">
                {formatAgo(item.ts)}
              </span>
            </div>
          ))}
          {items.length > 7 && (
            <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center pt-1">
              还有 {items.length - 7} 条记录
            </p>
          )}
        </div>
      )}
    </div>
  );
}