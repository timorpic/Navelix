"use client";
import { useLocale } from "next-intl";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/date-utils";

interface TodayActivityItem {
  id: string;
  text: string;
  icon: string;
  ts: number;
}


/** 右侧侧边栏小组件：今日动态（最近通知与系统活动预览） */
export default function TodayActivityWidget() {
  const locale = useLocale();
  const tx = useTranslations();
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
    <div className="shrink-0 rounded-2xl p-4 bg-white/90 dark:bg-slate-900/70 border border-gray-100 dark:border-slate-700 space-y-3 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-sm">⚡</span>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{tx("today_s_activity_09e08032")}</h3>
      </div>

      {loading ? (
        <p className="py-3 text-center text-xs text-gray-400 dark:text-slate-500">{tx("loading_4927a53b")}</p>
      ) : items.length === 0 ? (
        <p className="py-3 text-center text-xs text-gray-400 dark:text-slate-500">{tx("no_activity_yet_b5046209")}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 min-w-0">
              <span className="text-xs shrink-0">{item.icon}</span>
              <span className="flex-1 text-xs text-gray-600 dark:text-slate-300 truncate">
                {item.text}
              </span>
              <span className="text-[9px] text-gray-400 dark:text-slate-500 shrink-0">
                {formatRelativeTime(item.ts, { style: "compact", fallbackAfterDays: Infinity , locale})}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
