"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

interface ModelUsage {
  name: string;
  remaining_pct: number;
  remaining_label: string;
}

interface UsageData {
  configured: boolean;
  enabled?: boolean;
  models: ModelUsage[];
  timestamp: string;
  account_id: string;
  error?: boolean;
  message?: string;
}

// 每 5 分钟自动刷新一次
const REFRESH_MS = 5 * 60 * 1000;

// 余量健康度配色：充足=品牌绿，偏低=警告黄，紧张=危险红
function barColor(pct: number): string {
  if (pct >= 50) return "#00C776";
  if (pct >= 20) return "#FF9F00";
  return "#FF3B30";
}

function formatTime(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function SenseNovaUsage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/sensenova/usage", { cache: "no-store" });
      const json = (await res.json()) as UsageData;
      if (res.ok) {
        setData(json);
        setLastUpdated(new Date());
      } else if (res.status === 401) {
        setData({
          configured: true,
          models: [],
          timestamp: "",
          account_id: "",
          error: true,
          message: "未登录，无法加载",
        });
      } else {
        setData({
          configured: true,
          models: [],
          timestamp: "",
          account_id: "",
          error: true,
          message: json.message || "加载失败",
        });
      }
    } catch {
      setData({
        configured: true,
        models: [],
        timestamp: "",
        account_id: "",
        error: true,
        message: "网络请求失败，请稍后重试",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchData();
    });
    timerRef.current = setInterval(() => fetchData(), REFRESH_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchData]);

  return (
    <div className="flex flex-col bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-gray-100 dark:border-slate-700 shadow-2xs transition-colors">
      {/* 头部标题 + 手动刷新 */}
      <div className="flex items-center justify-between gap-1.5 mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm">🧠</span>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
            商汤当前窗口调用余量
          </h3>
        </div>
        <button
          type="button"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="text-[11px] font-semibold text-[#00C776] hover:underline flex items-center gap-0.5 shrink-0 cursor-pointer disabled:opacity-50"
          title="立即刷新"
        >
          <span className={refreshing ? "inline-block animate-spin" : ""}>🔄</span>
        </button>
      </div>

      {/* 内容区 */}
      {loading && !data ? (
        <p className="py-4 text-center text-[11px] text-gray-400 dark:text-slate-400">
          加载中…
        </p>
      ) : !data || !data.configured ? (
        <div className="py-3">
          <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed">
            {data && data.enabled === false
              ? "商汤用量面板已在后台关闭。"
              : "尚未在后台配置商汤凭据。"}
          </p>
          <p className="mt-1 text-[10px] text-gray-400 dark:text-slate-500 leading-relaxed">
            前往后台「设置 → 商汤 SenseNova」开启并填写账号密码后，即可显示各模型剩余额度。
          </p>
        </div>
      ) : data.error ? (
        <div className="py-3">
          <p className="text-[11px] text-rose-500 dark:text-rose-400 leading-relaxed">
            ⚠️ {data.message || "获取用量失败"}
          </p>
          <p className="mt-1 text-[10px] text-gray-400 dark:text-slate-500">
            最后尝试：{formatTime(lastUpdated)}
          </p>
        </div>
      ) : data.models.length === 0 ? (
        <p className="py-4 text-center text-[11px] text-gray-400 dark:text-slate-400">
          暂无模型用量数据
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.models.map((m) => (
            <div key={m.name} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[11px] text-gray-700 dark:text-slate-200 truncate"
                  title={m.name}
                >
                  {m.name}
                </span>
                <span
                  className="text-[11px] font-bold tabular-nums shrink-0"
                  style={{ color: barColor(m.remaining_pct) }}
                >
                  {m.remaining_label}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(0, Math.min(100, m.remaining_pct))}%`,
                    backgroundColor: barColor(m.remaining_pct),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 底部状态说明 */}
      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500">
        <span>每 5 分钟自动刷新</span>
        <span>更新于 {formatTime(lastUpdated)}</span>
      </div>
    </div>
  );
}
