"use client";

/**
 * ============================================================================
 * 📊 Navelix 管理后台「使用统计」Tab
 * ============================================================================
 *
 * 状态：已接入（admin/page.tsx 的 "analytics" tab 渲染本组件）
 * 依赖 API：
 *   GET  /api/admin/analytics/summary   → AnalyticsSummary（聚合一次性返回）
 *   GET  /api/admin/analytics/settings  → { enabled: boolean }
 *   POST /api/admin/analytics/settings  → { enabled? } | { action: "clear" }
 *
 * 设计要点：
 *   1. 零新增依赖（图表用内联 SVG / CSS 条形，不引图表库）
 *   2. 仅 admin 角色可见（由 admin/page.tsx 的 tab 体系天然保证）
 *   3. 未开启时展示启用横幅；开启后展示完整报表；请求失败展示空态
 *   4. 遵循 DESIGN_SYSTEM.md：品牌绿 #00C776，浅色 #F6F8FA / 深色 #151218
 * ============================================================================
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Toast from "@/components/toast";
import { useToast } from "@/hooks/use-toast";
import {
  EMPTY_SUMMARY,
  EVENT_LABELS,
  MODULES,
  VALUE_MOMENT_EVENT_COUNT,
  buildOverviewCards,
  trendScale,
  type AnalyticsSummary,
} from "@/lib/analytics-dashboard";

/* ──────────────────────────────────────────────────────────────
 * 类型定义（与后端 /api/admin/analytics/summary 约定）
 * ────────────────────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────
 * 主组件
 * ────────────────────────────────────────────────────────────── */
export default function AdminAnalyticsTab() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary>(EMPTY_SUMMARY);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const { notice, flash } = useToast();

  /** 拉取汇总 */
  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/analytics/summary");
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as AnalyticsSummary;
      setSummary({ ...EMPTY_SUMMARY, ...data });
      setEnabled(Boolean(data.enabled));
    } catch {
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      loadSummary();
    });
  }, [loadSummary]);

  /** 切换开关 */
  const toggleEnabled = useCallback(
    async (next: boolean) => {
      setEnabled(next);
      try {
        const res = await fetch("/api/admin/analytics/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: next }),
        });
        if (!res.ok) throw new Error("save failed");
        flash(next ? "使用统计已启用，数据仅存本机" : "使用统计已停用");
        loadSummary();
      } catch {
        setEnabled(!next);
        flash("设置保存失败，请重试");
      }
    },
    [flash, loadSummary],
  );

  /** 清空事件表（仅由「确认态按钮」或「警告横幅确认按钮」调用，直接执行） */
  const handleClear = useCallback(async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/admin/analytics/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      if (!res.ok) throw new Error("clear failed");
      flash("全部统计数据已清空");
      setConfirmClear(false);
      loadSummary();
    } catch {
      flash("清空失败，请重试");
    } finally {
      setClearing(false);
    }
  }, [flash, loadSummary]);

  const { stats, trend7d, topEvents, moduleBreakdown, retention } = summary;

  /* ── 7 日趋势图数据（内联 SVG 柱状） ── */
  const trend = useMemo(() => trendScale(trend7d), [trend7d]);

  /* ── 概览卡数据 ── */
  const cards = useMemo(() => buildOverviewCards(summary), [summary]);

  /* ── 渲染 ── */
  if (loading) {
    return (
      <div className="space-y-6 pb-12 animate-fadeIn">
        <div className="rounded-3xl border border-gray-100/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-sm text-gray-400 dark:text-slate-400">
          统计加载中…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* ── 顶部 Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <span className="text-xl">📊</span>
          <div>
            <h2 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">
              使用统计
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              激活 / 留存 / 功能使用率 —— 数据仅存本机，默认开启
            </p>
          </div>
        </div>
      </div>

      <Toast message={notice} className="dark:text-emerald-400" />

      {/* ═══════════════════════════════════════════════════════════════
          卡片 1：采集状态与开关（启用横幅 / 状态 + 清空）
         ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-gray-100/90 dark:border-slate-800 shadow-2xs transition-colors">
        {!enabled ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-base shrink-0">🔒</span>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
                  使用统计已停用
                </h3>
                <p className="text-xs text-gray-400 dark:text-slate-400 mt-1 leading-relaxed">
                  启用后在本机 SQLite 记录事件名、时间与聚合数量，<b>不采集</b>任何链接
                  URL、AI 对话内容或账号密钥，数据永不外发。
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => toggleEnabled(true)}
              className="shrink-0 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#00C776] hover:bg-[#00B368] transition-all cursor-pointer shadow-xs shadow-[#00C776]/25 flex items-center gap-2"
            >
              <span>▶</span>
              <span>启用使用统计</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-base shrink-0">🟢</span>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
                  使用统计已启用
                </h3>
                <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                  采集自 {summary.collectedSince ? new Date(summary.collectedSince).toLocaleString() : "本次开启"}，共 {stats.totalEvents.toLocaleString()} 条事件。数据仅存本机，可随时停用或清空。
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (!confirmClear) {
                      setConfirmClear(true);
                    } else {
                      handleClear();
                    }
                  }}
                  disabled={clearing}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    confirmClear
                      ? "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400"
                      : "bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-300 dark:hover:border-rose-800 hover:text-rose-600 dark:hover:text-rose-400"
                  }`}
                >
                  {confirmClear ? "再次点击确认清空" : clearing ? "清空中…" : "清空全部统计"}
                </button>
                <button
                  type="button"
                  onClick={() => toggleEnabled(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/60 transition-all cursor-pointer"
                >
                  停用
                </button>
              </div>
            </div>
            {confirmClear && (
              <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
                <span>⚠️ 此操作将永久删除本机全部统计事件，无法恢复。确定清空？</span>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={clearing}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-rose-500 hover:bg-rose-600 transition-colors cursor-pointer"
                >
                  确认清空
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          卡片 2：概览统计（4 卡）
         ═══════════════════════════════════════════════════════════════ */}
      {enabled && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((c) => (
              <div
                key={c.label}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100/90 dark:border-slate-800 shadow-2xs flex items-start justify-between transition-colors"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-gray-400 dark:text-slate-400 mb-1">
                    {c.label}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
                      {c.value}
                    </span>
                    {c.suffix && (
                      <span className="text-xs text-gray-400 dark:text-slate-400">{c.suffix}</span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400 dark:text-slate-400 mt-2">
                    {c.hint}
                  </span>
                </div>
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold ${c.color}`}
                >
                  {c.icon}
                </div>
              </div>
            ))}
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              卡片 3：近 7 日价值时刻趋势（内联 SVG 柱状图，零依赖）
             ═══════════════════════════════════════════════════════════════ */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-gray-100/90 dark:border-slate-800 shadow-2xs transition-colors">
            <div className="flex items-start gap-3 mb-5">
              <span className="text-base shrink-0">📈</span>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
                  近 7 日价值时刻趋势
                </h3>
                <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                  {VALUE_MOMENT_EVENT_COUNT} 类关键动作：点击导航、AI 对话、查看日历/甘特图、完成待办、新增/编辑链接、手动备份
                </p>
              </div>
            </div>

            {trend.data.length === 0 ? (
              <div className="py-10 text-center text-xs text-gray-400 dark:text-slate-400">
                暂无趋势数据，启用后开始记录
              </div>
            ) : (
              <div className="flex items-end gap-2 sm:gap-3 h-40">
                {trend.data.map((d) => {
                  const h = Math.max(4, Math.round((d.count / trend.max) * 128));
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400">
                        {d.count > 0 ? d.count : ""}
                      </span>
                      <div
                        className={`w-full max-w-10 rounded-t-lg transition-all ${
                          d.count > 0
                            ? "bg-gradient-to-t from-[#00B368] to-[#00C776]"
                            : "bg-gray-100 dark:bg-slate-800"
                        }`}
                        style={{ height: `${h}px` }}
                        title={`${d.date}: ${d.count} 次`}
                      />
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 truncate w-full text-center">
                        {d.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ═══════════════════════════════════════════════════════════════
                卡片 4：功能使用 Top 榜
               ═══════════════════════════════════════════════════════════════ */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-gray-100/90 dark:border-slate-800 shadow-2xs transition-colors">
              <div className="flex items-start gap-3 mb-5">
                <span className="text-base shrink-0">🏆</span>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
                    功能使用 Top 榜
                  </h3>
                  <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                    按事件计数降序，识别最常用的功能
                  </p>
                </div>
              </div>

              {topEvents.length === 0 ? (
                <div className="py-10 text-center text-xs text-gray-400 dark:text-slate-400">
                  暂无数据
                </div>
              ) : (
                <div className="space-y-3">
                  {topEvents.slice(0, 8).map((e, idx) => {
                    const max = topEvents[0]?.count || 1;
                    const pct = Math.max(4, Math.round((e.count / max) * 100));
                    return (
                      <div key={e.event} className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 shrink-0 rounded-lg text-[11px] font-extrabold flex items-center justify-center ${
                            idx === 0
                              ? "bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400"
                              : idx === 1
                                ? "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-300"
                                : idx === 2
                                  ? "bg-orange-50 dark:bg-orange-950/40 text-orange-500 dark:text-orange-400"
                                  : "bg-gray-50 dark:bg-slate-800/60 text-gray-400 dark:text-slate-500"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-800 dark:text-slate-200 truncate">
                              {e.label || EVENT_LABELS[e.event]?.label || e.event}
                            </span>
                            <span className="text-[11px] text-gray-400 dark:text-slate-400 shrink-0 ml-2">
                              {e.count.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#00C776]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                卡片 5：模块分布 + 留存简表
               ═══════════════════════════════════════════════════════════════ */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-gray-100/90 dark:border-slate-800 shadow-2xs transition-colors">
                <div className="flex items-start gap-3 mb-5">
                  <span className="text-base shrink-0">🧩</span>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
                      模块使用分布
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                      8 大模块事件占比
                    </p>
                  </div>
                </div>

                {moduleBreakdown.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400 dark:text-slate-400">
                    暂无数据
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {MODULES.map((m) => {
                      const item = moduleBreakdown.find((b) => b.module === m);
                      if (!item || item.count === 0) return null;
                      return (
                        <div key={m} className="flex items-center gap-3">
                          <span className="w-10 shrink-0 text-[11px] font-semibold text-gray-600 dark:text-slate-300">
                            {m}
                          </span>
                          <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#00C776] to-emerald-400"
                              style={{ width: `${Math.max(3, item.percent)}%` }}
                            />
                          </div>
                          <span className="w-12 shrink-0 text-right text-[11px] text-gray-400 dark:text-slate-400">
                            {item.percent}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-gray-100/90 dark:border-slate-800 shadow-2xs transition-colors">
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-base shrink-0">🔁</span>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
                      留存简表
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                      按注册日分群的 D1 / D7 留存（样本 &lt; 3 不计算）
                    </p>
                  </div>
                </div>

                {retention.length === 0 ? (
                  <div className="py-8 text-center text-xs text-gray-400 dark:text-slate-400">
                    暂无足够样本，持续使用后自动生成
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[11px] text-gray-400 dark:text-slate-500 border-b border-gray-100 dark:border-slate-800">
                        <th className="pb-2 font-semibold">注册日</th>
                        <th className="pb-2 font-semibold text-right">样本</th>
                        <th className="pb-2 font-semibold text-right">D1</th>
                        <th className="pb-2 font-semibold text-right">D7</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {retention.map((r) => (
                        <tr
                          key={r.cohortDate}
                          className="border-b border-gray-50 dark:border-slate-800/60 last:border-0"
                        >
                          <td className="py-2.5 font-medium text-gray-800 dark:text-slate-200">
                            {r.cohortDate}
                          </td>
                          <td className="py-2.5 text-right text-gray-400 dark:text-slate-400">
                            {r.sampleSize}
                          </td>
                          <td className="py-2.5 text-right font-bold text-[#00C776]">
                            {r.d1 === null ? "—" : `${r.d1}%`}
                          </td>
                          <td className="py-2.5 text-right font-bold text-sky-500">
                            {r.d7 === null ? "—" : `${r.d7}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              卡片 6：隐私说明条
             ═══════════════════════════════════════════════════════════════ */}
          <div className="p-4 rounded-2xl bg-gray-50/90 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-800 flex items-start gap-3">
            <span className="text-sm shrink-0">🛡️</span>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed">
              隐私承诺：使用统计<b>仅记录事件名、时间与聚合数量</b>，全部存储于本机
              SQLite（<code className="font-mono">analytics_events</code>
              表），不采集链接 URL、AI 对话内容、账号密钥等敏感信息，数据永不外发。
              关闭或清空后立即停止记录。规范详见
              <span className="text-[#00C776]"> Wiki → 使用统计与埋点规范</span>。
            </p>
          </div>
        </>
      )}
    </div>
  );
}
