"use client";

import { useEffect, useState, useCallback } from "react";

export interface FocusStatsData {
  totalHours: number;
  weeklyChange: number;
  dailyAverage: number;
  isPositive: boolean;
  weeklyData: number[]; // 7 days: Mon - Sun in hours
}

const STORAGE_KEY = "navelix.focus.tracker.v1";

function getDayIndex(date: Date): number {
  return (date.getDay() + 6) % 7; // 0=Mon, 6=Sun
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

      // Aggregate this week's seconds per day
      for (let i = 0; i < 7; i++) {
        const d = new Date(thisMonday);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        const sec = history[dateStr] || 0;
        thisWeekData[i] = parseFloat((sec / 3600).toFixed(1));
      }

      // Aggregate last week's seconds per day
      for (let i = 0; i < 7; i++) {
        const d = new Date(lastMonday);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        const sec = history[dateStr] || 0;
        lastWeekData[i] = parseFloat((sec / 3600).toFixed(1));
      }

      const thisWeekTotalSec = Object.values(thisWeekData).reduce((a, b) => a + b, 0) * 3600;
      const lastWeekTotalSec = Object.values(lastWeekData).reduce((a, b) => a + b, 0) * 3600;

      const totalHours = parseFloat((thisWeekTotalSec / 3600).toFixed(1));
      const lastWeekTotalHours = parseFloat((lastWeekTotalSec / 3600).toFixed(1));

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

      const newStats: FocusStatsData = {
        totalHours,
        weeklyChange,
        dailyAverage,
        isPositive,
        weeklyData: thisWeekData,
      };

      setStats(newStats);

      // Also mirror to legacy key for backwards compatibility
      localStorage.setItem("navelix.focus.stats", JSON.stringify(newStats));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    recalculateStats();

    let isTabVisible = typeof document !== "undefined" ? !document.hidden : true;

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Track seconds continuously as long as Navelix page tab is open & visible
    const interval = setInterval(() => {
      if (isTabVisible) {
        try {
          const dateStr = new Date().toISOString().split("T")[0];
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
