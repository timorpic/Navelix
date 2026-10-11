"use client";
import { useAdminAnalyticsSettings } from "@/hooks/use-admin-analytics-settings";
export default function AdminAnalyticsSettingsCard() {
  const settings = useAdminAnalyticsSettings();
  return <div className="rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-3">
    <h3 className="font-bold">使用统计</h3><p className="text-xs text-gray-500">记录本站使用事件，用于后台统计报表。匿名遥测由另一个开关控制。</p>
    <button type="button" disabled={settings.enabled === null || settings.saving} onClick={settings.toggle} className="px-4 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50">{settings.enabled === null ? "读取中…" : settings.enabled ? "已开启" : "已关闭"}</button>
    {settings.error && <p role="alert" className="text-sm text-rose-600">{settings.error}</p>}
  </div>;
}
