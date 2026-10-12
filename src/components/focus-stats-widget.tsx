"use client";

import { useTranslations } from "next-intl";
import { useFocusTracker } from "@/hooks/use-focus-tracker";
export default function FocusStatsWidget() {
  const tx = useTranslations();
  const { totalHours, weeklyChange, dailyAverage, isPositive, weeklyData } =
    useFocusTracker();

  const maxHours = Math.max(...weeklyData, 1);
  const dayNames = [tx("mon_51a75f46"), tx("tue_084b42f6"), tx("wed_a4c3313d"), tx("thu_754a9d58"), tx("fri_c9b87f51"), tx("sat_de07b538"), tx("sun_85217f7a")];
  const currentDayIdx = (new Date().getDay() + 6) % 7; // 0=Mon, 6=Sun

  return (
    <div className="flex flex-col bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-center">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 19h2V10H5v9zm7 0h2V5h-2v14zm7 0h2v-7h-2v7zm2 2H3v-2h18v2z" />
            </svg>
          </span>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1">
            <span>{tx("focus_statistics_305471d2")}</span>
          </h3>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 text-[10px] font-bold">
          {tx("this_week_b4c6c3eb")}</span>
      </div>

      {/* Main Metric Numbers */}
      <div className="flex items-baseline justify-between my-1">
        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
            {tx("total_focus_this_week_fc6e8b73")}</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
              {totalHours}
            </span>
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
              {tx("hours_3b6fefc5")}</span>
          </div>
        </div>

        {/* Weekly Trend Badge */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-gray-400 dark:text-slate-500 mb-0.5">
            {tx("vs_last_week_1fb367f5")}</span>
          <div
            className={`px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-0.5 ${
              isPositive
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/60"
                : "bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400 border border-red-200/60 dark:border-red-900/60"
            }`}
          >
            <span>{isPositive ? "↑" : "↓"}</span>
            <span>
              {isPositive ? "+" : "-"}
              {weeklyChange}%
            </span>
          </div>
        </div>
      </div>

      {/* 7-Day Weekly Bar Chart */}
      <div className="mt-2.5 mb-1 pt-2 px-1 border-t border-gray-100 dark:border-slate-700/60 flex flex-col gap-1">
        {/* 无数据时显示引导提示 */}
        {maxHours <= 0.01 ? (
          <div className="flex flex-col items-center justify-center h-16 gap-1">
            <div className="flex items-end gap-1 h-10 opacity-20">
              {[2, 4, 3, 6, 5, 7, 4].map((v, i) => (
                <div
                  key={i}
                  className="flex-1 bg-[#00C776]/40 rounded-t-sm"
                  style={{ height: `${(v / 7) * 100}%` }}
                />
              ))}
            </div>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center">
              {tx("keep_the_page_open_to_automatically_accumulate_f_85a06526")}</p>
          </div>
        ) : (
          <div className="flex items-end justify-between gap-1.5" style={{ height: "56px" }}>
            {weeklyData.map((val, idx) => {
              const heightPercent = Math.max(Math.round((val / maxHours) * 100), val > 0 ? 6 : 0);
              const isToday = idx === currentDayIdx;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center justify-end group relative h-full">
                  <div
                    className={`w-full rounded-t-md transition-all duration-500 ease-out ${
                      isToday
                        ? "bg-[#00C776] shadow-[0_0_8px_rgba(0,199,118,0.5)]"
                        : "bg-[#00C776]/30 dark:bg-[#00C776]/25 group-hover:bg-[#00C776]/60"
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  />
                  {/* Tooltip on hover */}
                  <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 dark:bg-slate-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-20">
                    {val}h
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500 font-semibold px-0.5 mt-1">
          {dayNames.map((d, i) => (
            <span key={i} className={i === currentDayIdx ? "text-[#00C776] font-bold" : ""}>
              {d}
            </span>
          ))}
        </div>
      </div>

      {/* Sub Stats Footer */}
      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
        <span className="text-gray-400 dark:text-slate-400">
          {tx("daily_average_focus_98575f09")}{dailyAverage} {tx("hours_3b6fefc5")}</span>
        <span className="font-semibold text-[#00C776] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00C776] animate-pulse" />
          <span>{tx("in_progress_dc9591e5")}</span>
        </span>
      </div>
    </div>
  );
}
