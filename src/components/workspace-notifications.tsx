"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { useNavelixConfig, useNavelixData } from "@/context/navelix-context";
import { useDismissiblePopover } from "@/hooks/use-dismissible-popover";
import type { WorkspaceNotificationsState } from "@/hooks/use-workspace-notifications";
import PendingRemindersWidget from "@/components/pending-reminders-widget";

export default function WorkspaceNotifications({ feed, onNavigate }: { feed: WorkspaceNotificationsState; onNavigate: (category: string) => void }) {
  const t = useTranslations();
  const { config } = useNavelixConfig();
  const { todos } = useNavelixData();
  const { open, setOpen, container, trigger } = useDismissiblePopover();
  const id = useId();
  const count = feed.unreadCount + (config.pendingRemindersEnabled !== false ? todos.filter(todo => !todo.done).length : 0);
  const navigate = (category: string) => { setOpen(false); onNavigate(category); trigger.current?.focus(); };
  return <div ref={container} className="relative">
    <button ref={trigger} type="button" aria-label={t("workspace_notifications")} aria-expanded={open} aria-controls={id}
      onClick={() => { setOpen(!open); if (!open) void feed.refresh(); }}
      className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-gray-100 bg-white/90 text-gray-600 shadow-2xs transition-colors hover:border-[#00C776]/40 hover:text-[#00C776] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00C776] dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-300 dark:shadow-none dark:hover:border-[#00C776]/30 dark:hover:bg-white/10 dark:hover:text-[#00C776]">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path strokeLinecap="round" strokeLinejoin="round" d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {count > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#00C776] px-1 text-[10px] leading-4 font-bold text-white" aria-label={t("workspace_notification_count", { v0: count })}>{count > 99 ? "99+" : count}</span>}
    </button>
    {open && <section id={id} aria-label={t("workspace_notifications")} className="absolute right-0 top-full mt-3 max-h-[min(70dvh,36rem)] w-[min(22rem,calc(100vw-3rem))] overflow-y-auto overscroll-contain rounded-2xl border border-gray-100 bg-white p-4 shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-sm font-bold">{t("workspace_notifications")}</h2>
        <button type="button" onClick={() => void feed.markAllRead()} disabled={feed.markingRead || !feed.unreadCount} className="min-h-9 text-xs font-medium text-[#00A561] hover:underline disabled:opacity-40 dark:text-[#00C776]">{t("workspace_mark_read")}</button>
      </div>
      {config.pendingRemindersEnabled !== false && <><PendingRemindersWidget /><button type="button" onClick={() => navigate("feature-calendar")} className="mb-4 mt-1 min-h-9 text-xs font-semibold text-[#00A561] hover:underline dark:text-[#00C776]">{t("workspace_view_schedule")} →</button></>}
      <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400">{t("workspace_recent_notifications")}</h3>
      {feed.loading ? <p role="status" className="py-4 text-xs text-gray-400">{t("loading_4927a53b")}</p> : feed.notifications.length === 0 && !feed.error ? <p className="py-4 text-xs text-gray-400">{t("no_activity_yet_b5046209")}</p> : <ul className="mt-2 divide-y divide-gray-100 dark:divide-slate-800">{feed.notifications.slice(0, 5).map(item => <li key={item.id} className="flex gap-2 py-3"><span aria-hidden="true" className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${item.read ? "bg-gray-200 dark:bg-slate-600" : "bg-[#00C776]"}`} /><div className="min-w-0"><p className="break-words text-xs font-medium">{item.title}</p><p className="mt-1 line-clamp-2 break-words text-xs text-gray-500 dark:text-slate-400">{item.content}</p></div></li>)}</ul>}
      {feed.error && <div role="alert" className="py-3 text-xs text-rose-600 dark:text-rose-400">{t("workspace_notifications_error")} <button type="button" onClick={() => void feed.refresh()} className="min-h-9 underline">{t("workspace_retry")}</button></div>}
      <button type="button" onClick={() => navigate("feature-activities")} className="mt-2 min-h-10 w-full rounded-xl bg-gray-50 text-xs font-semibold hover:bg-emerald-50 hover:text-[#00A561] dark:bg-slate-800 dark:hover:bg-emerald-950/40 dark:hover:text-[#00C776]">{t("workspace_view_all")} →</button>
    </section>}
  </div>;
}
