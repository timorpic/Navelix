"use client";

import { useEffect, useState, useCallback } from "react";

export interface FocusStatsData {
  totalHours: number;
  weeklyChange: number;
  dailyAverage: number;
  isPositive: boolean;
  weeklyData: number[]; // 7 days: Mon - Sun in hours
  todayMinutes: number;
}

const STORAGE_KEY = "navelix.focus.tracker.v1";

function getDayIndex(date: Date): number {
  return (date.getDay() + 6) % 7; // 0=Mon, 6=Sun
}

function getLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function useFocusTracker() {
  const [stats, setStats] = useState<FocusStatsData>(() => {
    return {
      totalHours: 0,
      weeklyChange: 0,
      dailyAverage: 0,
      isPositive: true,
      weeklyData: [0, 0, 0, 0, 0, 0, 0],
      todayMinutes: 0,
    };
  });

  // Calculate stats from local storage history
  const recalculateStats = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const history: Record<string, number> = raw ? JSON.parse(raw) : {};

      const now = new Date();
      const thisMonday = getMonday(now);
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(lastMonday.getDate() - 7);

      const thisWeekData = [0, 0, 0, 0, 0, 0, 0];
      const lastWeekData = [0, 0, 0, 0, 0, 0, 0];

      // Aggregate this week's seconds per day using local date strings
      for (let i = 0; i < 7; i++) {
        const d = new Date(thisMonday);
        d.setDate(d.getDate() + i);
        const dateStr = getLocalDateStr(d);
        const sec = history[dateStr] || 0;
        thisWeekData[i] = parseFloat((sec / 3600).toFixed(1));
      }

      // Aggregate last week's seconds per day using local date strings
      for (let i = 0; i < 7; i++) {
        const d = new Date(lastMonday);
        d.setDate(d.getDate() + i);
        const dateStr = getLocalDateStr(d);
        const sec = history[dateStr] || 0;
        lastWeekData[i] = parseFloat((sec / 3600).toFixed(1));
      }

      const totalHours = parseFloat(
        thisWeekData.reduce((sum, h) => sum + h, 0).toFixed(1),
      );
      const lastWeekTotalHours = parseFloat(
        lastWeekData.reduce((sum, h) => sum + h, 0).toFixed(1),
      );

      let weeklyChange = 0;
      let isPositive = true;

      if (lastWeekTotalHours > 0) {
        const diff = ((totalHours - lastWeekTotalHours) / lastWeekTotalHours) * 100;
        weeklyChange = parseFloat(Math.abs(diff).toFixed(1));
        isPositive = diff >= 0;
      } else if (totalHours > 0) {
        weeklyChange = 100;
        isPositive = true;
      }

      const daysPassedSoFar = getDayIndex(now) + 1;
      const dailyAverage = parseFloat((totalHours / daysPassedSoFar).toFixed(1));

      // 今日专注分钟数（秒→向下取整分钟，确保刚专注即能实时反映）
      const todayMinutes = Math.floor((history[getLocalDateStr(now)] || 0) / 60);

      const newStats: FocusStatsData = {
        totalHours,
        weeklyChange,
        dailyAverage,
        isPositive,
        weeklyData: thisWeekData,
        todayMinutes,
      };

      setStats(newStats);

      // Also mirror to legacy key for backwards compatibility
      localStorage.setItem("navelix.focus.stats", JSON.stringify(newStats));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      recalculateStats();
    });

    let isTabVisible = typeof document !== "undefined" ? !document.hidden : true;

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Track seconds continuously as long as Navelix page tab is open & visible
    const interval = setInterval(() => {
      if (isTabVisible) {
        try {
          const dateStr = getLocalDateStr(new Date());
          const raw = localStorage.getItem(STORAGE_KEY);
          const history: Record<string, number> = raw ? JSON.parse(raw) : {};

          history[dateStr] = (history[dateStr] || 0) + 5; // add 5 seconds
          localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

          recalculateStats();
        } catch {
          // ignore
        }
      }
    }, 5000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, [recalculateStats]);

  return stats;
}
