"use client";

import { eeDriverStatusLabel, eeDriverStatusDescription, type EEDriverStatus } from "@/lib/ee-driver-status";

export default function AdminProEEDriverCard({ status, loading, error, onRefresh }: {
  status: EEDriverStatus | null;
  loading: boolean;
  error: boolean;
  onRefresh: () => Promise<void>;
}) {
  const visible = !loading && !error ? status : null;
  const label = loading ? "正在查询…" : error ? "状态查询失败" : status ? eeDriverStatusLabel(status.state) : "加载状态未知";
  return (
    <section aria-labelledby="ee-driver-heading" className="rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id="ee-driver-heading" className="text-base font-bold text-gray-900 dark:text-white">EE 驱动状态</h3>
        <button type="button" disabled={loading} onClick={() => void onRefresh()} className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 disabled:opacity-50 cursor-pointer">刷新状态</button>
      </div>
      <p data-testid="ee-driver-state" role="status" className={`text-sm font-semibold ${visible?.state === "loaded" ? "text-emerald-700 dark:text-emerald-300" : "text-gray-700 dark:text-slate-200"}`}>{label}</p>
      {visible && <dl className="grid gap-3 sm:grid-cols-2 text-xs text-gray-600 dark:text-slate-300">
        <div><dt className="font-semibold">存储驱动（S3 / WebDAV）</dt><dd className="mt-1">{visible.storageRegistered ? "已注册" : "未注册"}</dd></div>
        <div><dt className="font-semibold">网络探针驱动</dt><dd className="mt-1">{visible.probeRegistered ? "已注册" : "未注册"}</dd></div>
      </dl>}
      <p className="text-xs leading-relaxed text-gray-500 dark:text-slate-400">
        {loading ? "正在读取服务端的实际驱动状态。" : error ? "暂时无法获取驱动状态，请重试。" : visible ? eeDriverStatusDescription(visible) : "请刷新获取驱动状态。"}
      </p>
    </section>
  );
}
