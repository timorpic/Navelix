"use client";

import { useCallback, useEffect, useState } from "react";
import { useNavelixConfig } from "@/context/navelix-context";

/**
 * 侧边栏「时钟 / 天气 / 模拟指针」小部件。
 *
 * 从 `sidebar.tsx`（原 736 行）整块抽出 —— 该小部件自带秒级定时器、
 * 天气拉取与表盘 SVG，与侧边栏导航**没有任何逻辑关联**，此前却被塞在同一文件里。
 * 状态与副作用随组件一起迁移，侧边栏因此不再持有这些状态。
 */

type ClockTab = "time" | "weather" | "analog";

interface WeatherData {
  temp: number;
  windSpeed: number;
  desc: string;
  icon: string;
  isDay: boolean;
  location: string;
  updatedAt: string;
}

export default function ClockWeatherWidget() {
  const { config } = useNavelixConfig();

  // 初始值直接取自配置，无需 effect 同步
  const [clockTab, setClockTab] = useState<ClockTab>(
    () => config.clockWidgetMode || "time",
  );
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  // 秒级时钟
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 获取天气数据（调后端代理 /api/weather，隐藏 API Key 和位置）
  const fetchWeather = useCallback(async () => {
    try {
      const res = await fetch("/api/weather");
      if (!res.ok) {
        setWeather(null);
        return;
      }
      const data = await res.json();
      if (data.enabled === false || data.error) {
        setWeather(null);
        return;
      }
      // 降级状态：API 返回 isFallback 时显示"数据更新中"而非模拟数据
      if (data.isFallback) {
        setWeather({
          temp: NaN,
          windSpeed: 0,
          desc: "数据更新中",
          icon: "🔄",
          isDay: true,
          location: data.location || "实时",
          updatedAt: "",
        });
        return;
      }
      setWeather({
        temp: data.temp || 24,
        windSpeed: data.windSpeed || 12,
        desc: data.desc || "晴",
        icon: "☀️",
        isDay: true,
        location: data.location || "实时",
        updatedAt: data.updatedAt || "",
      });
    } catch {
      setWeather(null);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchWeather();
    });
    const interval = setInterval(fetchWeather, 10 * 60 * 1000); // 每 10 分钟刷新
    return () => clearInterval(interval);
  }, [fetchWeather]);

  return (
    <div className="px-2 py-1.5 rounded-xl text-center bg-gray-50 text-gray-800 dark:bg-slate-800/60 dark:text-slate-100">
      {/* Tab 切换条 */}
      <div className="flex items-center gap-0.5 mb-1.5 bg-black/5 dark:bg-white/5 rounded-lg p-0.5">
        <button
          onClick={() => setClockTab("time")}
          className={`flex-1 py-0.5 px-1.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
            (config.clockWidgetMode || clockTab) === "time" || clockTab === "time"
              ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300"
          }`}
        >
          <span>时钟</span>
        </button>
        <button
          onClick={() => setClockTab("weather")}
          className={`flex-1 py-0.5 px-1.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
            clockTab === "weather"
              ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300"
          }`}
        >
          <span>天气</span>
        </button>
        <button
          onClick={() => setClockTab("analog")}
          className={`flex-1 py-0.5 px-1.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 ${
            clockTab === "analog"
              ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
              : "text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300"
          }`}
        >
          <span>指针</span>
        </button>
      </div>

        {clockTab === "time" ? (
          <>
            <p suppressHydrationWarning className="text-lg font-bold tabular-nums leading-tight">
              {now.toLocaleTimeString("zh-CN", { hour12: false })}
            </p>
            <p suppressHydrationWarning className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
              {now.getMonth() + 1}月{now.getDate()}日{" "}
              {["周日", "周一", "周二", "周三", "周四", "周五", "周六"][now.getDay()]}
            </p>
          </>
        ) : clockTab === "analog" ? (
          <div className="flex flex-col items-center justify-center py-1">
            <svg className="w-12 h-12" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" className="fill-none stroke-teal-500/40 dark:stroke-teal-400/40" strokeWidth="3" />
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
                <line
                  key={deg}
                  x1="50" y1="10" x2="50" y2="14"
                  className="stroke-gray-400 dark:stroke-slate-500" strokeWidth="2"
                  transform={`rotate(${deg} 50 50)`}
                />
              ))}
              {/* 时针 */}
              <line
                x1="50" y1="50" x2="50" y2="28"
                className="stroke-gray-800 dark:stroke-white" strokeWidth="3.5" strokeLinecap="round"
                transform={`rotate(${(now.getHours() % 12) * 30 + now.getMinutes() * 0.5} 50 50)`}
              />
              {/* 分针 */}
              <line
                x1="50" y1="50" x2="50" y2="20"
                className="stroke-teal-500 dark:stroke-teal-400" strokeWidth="2.5" strokeLinecap="round"
                transform={`rotate(${now.getMinutes() * 6} 50 50)`}
              />
              {/* 秒针 */}
              <line
                x1="50" y1="55" x2="50" y2="16"
                className="stroke-rose-500" strokeWidth="1.5" strokeLinecap="round"
                transform={`rotate(${now.getSeconds() * 6} 50 50)`}
              />
              <circle cx="50" cy="50" r="3" className="fill-rose-500" />
            </svg>
            <p suppressHydrationWarning className="text-[10px] text-gray-400 dark:text-slate-400 mt-1 font-mono">
              {now.toLocaleTimeString("zh-CN", { hour12: false })}
            </p>
          </div>
        ) : weather ? (
          <>
            <p className="text-lg font-bold leading-tight flex items-center justify-center gap-1.5">
              {weather.icon.startsWith("http") ? (
                /* eslint-disable-next-line @next/next/no-img-element -- 动态天气图标地址 */
                <img src={weather.icon} alt={weather.desc} className="w-7 h-7" />
              ) : (
                <span>{weather.icon}</span>
              )}
              <span>{Number.isNaN(weather.temp) ? "" : `${weather.temp}°C`}</span>
            </p>
            <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5 flex items-center justify-center gap-1">
              <span>{weather.desc}</span>
              <span>·</span>
              <span>{weather.location}</span>
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-bold tabular-nums leading-tight">--°C</p>
            <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
              未配置天气
            </p>
          </>
        )}
    </div>
  );
}
