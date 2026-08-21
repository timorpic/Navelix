"use client";

import { useCallback, useEffect, useState } from "react";

interface TodayActivityItem {
  id: string;
  text: string;
  icon: string;
  ts: number;
}

function formatAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / min)}m`;
  if (diff < day) return `${Math.floor(diff / hour)}h`;
  return `${Math.floor(diff / day)}d`;
}

/** 右侧侧边栏小组件：今日动态（最近通知与系统活动预览） */
export default function TodayActivityWidget() {
  const [items, setItems] = useState<TodayActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      const notifs: TodayActivityItem[] = (data.notifications || [])
        .slice(0, 8)
        .map((n: { id: string; title: string; content: string; createdAt: number }) => ({
          id: `n-${n.id}`,
          text: n.content || n.title,
          icon: n.title.includes("🐳")
            ? "🐳"
            : n.title.includes("💾")
            ? "💾"
            : n.title.includes("📌")
            ? "📌"
            : "🔔",
          ts: n.createdAt,
        }));
      setItems(notifs);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
    const handle = () => load();
    window.addEventListener("navelix-workspace-updated", handle);
    return () => window.removeEventListener("navelix-workspace-updated", handle);
  }, [load]);

  return (
    <div className="rounded-2xl p-4 bg-white/90 dark:bg-slate-900/70 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-3 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-sm">⚡</span>
        <h3 className="text-xs font-black text-gray-900 dark:text-white tracking-wide">今日动态</h3>
      </div>

      {loading ? (
        <p className="py-3 text-center text-[10px] text-gray-400 dark:text-slate-500">加载中…</p>
      ) : items.length === 0 ? (
        <p className="py-3 text-center text-[10px] text-gray-400 dark:text-slate-500">暂无动态</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 min-w-0">
              <span className="text-[11px] shrink-0">{item.icon}</span>
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
