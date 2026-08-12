"use client";

import React, { useState, useEffect } from "react";

export default function FocusStatsWidget() {
  const [totalHours, setTotalHours] = useState(28.5);
  const [weeklyChange, setWeeklyChange] = useState(15.8);
  const [dailyAverage, setDailyAverage] = useState(4.1);
  const [isPositive, setIsPositive] = useState(true);

  // Load or calculate local focus statistics
  useEffect(() => {
    try {
      const raw = localStorage.getItem("navelix.focus.stats");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.totalHours === "number") setTotalHours(parsed.totalHours);
        if (typeof parsed.weeklyChange === "number") {
          setWeeklyChange(Math.abs(parsed.weeklyChange));
          setIsPositive(parsed.weeklyChange >= 0);
        }
        if (typeof parsed.dailyAverage === "number") setDailyAverage(parsed.dailyAverage);
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="flex flex-col bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-xs">
            ⏱️
          </span>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            专注统计
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

      {/* Sub Stats Footer */}
      <div className="mt-3 pt-2.5 border-t border-gray-100 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
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
