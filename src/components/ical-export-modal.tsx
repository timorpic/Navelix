"use client";

import { useTranslations } from "next-intl";
import Overlay from "./overlay";

/**
 * iCal 订阅与导出弹窗。
 *
 * 从 `calendar-view.tsx`（原 1457 行）抽出 —— 该文件把三个互不相关的弹窗
 * （iCal 导出 / AI 排程建议 / 编辑日程）与主视图塞在一起。本弹窗完全自包含，
 * 只依赖自身的开关状态。
 */
export default function IcalExportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const tx = useTranslations();
  if (!open) return null;

  return (
    <Overlay title={tx("calendar_subscription_export_ical_ics_40b41d3c")} onClose={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-gray-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
            <span>📲</span>
            <span>{tx("calendar_subscription_export_ical_ics_40b41d3c")}</span>
          </h3>
          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
          {tx("sync_navelix_milestones_and_todo_schedules_to_ap_2721259a")}</p>

        <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 space-y-2">
          <span className="block text-[11px] font-bold text-gray-500 dark:text-slate-400">
            {tx("download_an_icalendar_file_b3b2bdaa")}</span>
          <a
            href="/api/calendar/export"
            download="navelix-schedule.ics"
            className="w-full py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>📥</span>
            <span>{tx("download_navelix_schedule_ics_6ecf282a")}</span>
          </a>
        </div>

        <div className="text-[11px] text-gray-400 space-y-1">
          <p>{tx("on_your_phone_c7625a92")}</p>
          <p>{tx("ios_open_the_download_in_files_and_choose_add_al_62c9b0c5")}</p>
          <p>{tx("google_outlook_choose_import_calendar_in_calenda_b2925ef8")}</p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-100 dark:bg-slate-800 text-xs font-bold rounded-xl"
          >
            {tx("close_3fd47edc")}</button>
        </div>
      </div>
    </Overlay>
  );
}
