"use client";

import React from "react";
import { useFocusTracker } from "@/hooks/use-focus-tracker";

export default function FocusStatsWidget() {
  const { totalHours, weeklyChange, dailyAverage, isPositive, weeklyData } =
    useFocusTracker();

  const maxHours = Math.max(...weeklyData, 1);
  const dayNames = ["一", "二", "三", "四", "五", "六", "日"];
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
            <span>专注统计</span>
          </h3>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 text-[10px] font-bold">
          本周
        </span>
      </div>

      {/* Main Metric Numbers */}
      <div className="flex items-baseline justify-between my-1">
        <div>
          <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
            专注总时长
          </span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">
              {totalHours}
            </span>
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
              小时
            </span>
          </div>
        </div>

        {/* Weekly Trend Badge */}
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-gray-400 dark:text-slate-500 mb-0.5">
            较上周
          </span>
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

      {/* Mini 7-Day Weekly Bar Chart */}
      <div className="mt-2.5 mb-1 pt-2 px-1 border-t border-gray-100 dark:border-slate-700/60 flex flex-col gap-1">
        <div className="flex items-end justify-between h-10 gap-1.5">
          {weeklyData.map((val, idx) => {
            const heightPercent = Math.round((val / maxHours) * 100);
            const isToday = idx === currentDayIdx;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div
                  className="w-full rounded-t-md transition-all duration-200"
                  style={{ height: `${heightPercent}%` }}
                >
                  <div
                    className={`w-full h-full rounded-t-md transition-all ${
                      isToday
                        ? "bg-[#00C776] shadow-[0_0_8px_rgba(0,199,118,0.7)]"
                        : "bg-[#00C776]/30 dark:bg-[#00C776]/25 group-hover:bg-[#00C776]/60"
                    }`}
                  />
                </div>
                {/* Tooltip on hover */}
                <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 dark:bg-slate-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-20">
                  {val}h
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500 font-semibold px-0.5">
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
          日均专注 {dailyAverage} 小时
        </span>
        <span className="font-semibold text-[#00C776] flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00C776] animate-pulse" />
          <span>进行中</span>
        </span>
      </div>
    </div>
  );
}
