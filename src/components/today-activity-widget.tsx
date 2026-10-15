"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatRelativeTime } from "@/lib/date-utils";
import type { WorkspaceNotificationsState } from "@/hooks/use-workspace-notifications";

/** Compact home activity strip, using the same feed as the notification bell. */
export default function TodayActivityWidget({ feed, onViewAll }: { feed: WorkspaceNotificationsState; onViewAll: () => void }) {
  const locale = useLocale();
  const t = useTranslations();
  return <section aria-label={t("workspace_recent_activity")} className="rounded-2xl border border-gray-100 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-900/80">
    <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-bold"><span aria-hidden="true" className="mr-2 text-amber-500">ϟ</span>{t("workspace_recent_activity")}</h2><button type="button" onClick={onViewAll} className="min-h-9 text-xs font-semibold text-[#00A561] hover:underline dark:text-[#00C776]">{t("workspace_view_all")} →</button></div>
    {feed.error ? <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{t("workspace_notifications_error")} <button type="button" onClick={() => void feed.refresh()} className="min-h-9 underline">{t("workspace_retry")}</button></p> : feed.loading ? <p role="status" className="py-3 text-xs text-gray-400">{t("loading_4927a53b")}</p> : feed.notifications.length === 0 ? <p className="py-3 text-xs text-gray-400 dark:text-slate-500">{t("no_activity_yet_b5046209")}</p> : <ul className="mt-2 flex gap-4 overflow-x-auto pb-2">{feed.notifications.slice(0, 6).map(item => <li key={item.id} className="flex w-60 shrink-0 gap-2 border-r border-gray-100 pr-4 last:border-0 dark:border-slate-800"><span aria-hidden="true" className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00C776]" /><div className="min-w-0"><p className="truncate text-xs font-medium text-gray-700 dark:text-slate-200" title={item.content || item.title}>{item.content || item.title}</p><p className="mt-1.5 text-[10px] text-gray-400 dark:text-slate-500">{formatRelativeTime(item.createdAt, { style: "compact", fallbackAfterDays: Infinity, locale })}</p></div></li>)}</ul>}
  </section>;
}
