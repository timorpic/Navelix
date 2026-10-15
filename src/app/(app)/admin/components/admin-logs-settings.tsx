"use client";
import { useLocale, useTranslations } from "next-intl";
import { LOG_CATEGORIES, type LogSettings } from "@/lib/logging/types";
import { useConfirm } from "@/hooks/use-confirm";
import { useAdminLogSettings } from "@/hooks/use-admin-log-settings";
import ConfirmDialog from "@/components/confirm-dialog";
const control = "min-w-0 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[#00C776]";
export default function AdminLogsSettings() {
  const t = useTranslations(); const locale = useLocale();
  const { confirm, dialogProps } = useConfirm();
  const { settings, stats, busy, status, cleanupDialog, update, perform, retry } = useAdminLogSettings(confirm);
  if (!settings) return <div className="space-y-3"><p role="status">{status || t("logs_loading")}</p>{status && <button className={control} onClick={retry}>{t("logs_refresh")}</button>}</div>;
  return <><form className="space-y-5" onSubmit={event => { event.preventDefault(); void perform(false); }}>
    {stats && <div className="rounded-xl bg-gray-50 dark:bg-slate-900 p-4 text-sm space-y-2">
      <p>{t("logs_storage", { v0: (stats.health.bytes / 1048576).toFixed(1), v1: stats.health.files, v2: stats.auditCount })}</p>
      <p>{t("logs_dropped", { v0: stats.health.dropped })}</p>
      {(!stats.health.readable || stats.health.lastErrorAt > stats.health.successfulWriteAt) && <p className="text-rose-500">{t("logs_writeFailure")}</p>}
      <p className="font-semibold">{t("logs_trend")}</p>
      <div className="flex items-end gap-1 h-16" role="img" aria-label={t("logs_trend")}>{stats.trend.map(bucket => <div key={bucket.time} className={`flex-1 min-w-0 rounded-t ${bucket.errors ? "bg-amber-400" : "bg-[#00C776]/70"}`} title={`${new Date(bucket.time).toLocaleTimeString(locale)} · ${bucket.count}`} style={{ height: `${Math.max(4, bucket.count / Math.max(1, ...stats.trend.map(b => b.count)) * 100)}%` }} />)}</div>
      {stats.errors.length > 0 && <div><p className="font-semibold">{t("logs_errorGroups")}{stats.partial ? ` · ${t("logs_partial")}` : ""}</p>{stats.errors.map(group => <p key={group.event} className="break-all">{group.event} × {group.count}</p>)}</div>}
    </div>}
    <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">{t("logs_level")}<select className={control} value={settings.level} onChange={e => update("level", e.target.value as "info" | "debug")}><option value="info">info</option><option value="debug">debug · {t("logs_debugExpiry")}</option></select></label>
      <label className="flex flex-col gap-1 text-sm">{t("logs_auditRetention")}<select className={control} value={settings.auditRetentionDays} onChange={e => update("auditRetentionDays", Number(e.target.value) as LogSettings["auditRetentionDays"])}>{[0, 90, 180, 365].map(days => <option key={days} value={days}>{days === 0 ? t("logs_forever") : `${days} ${t("logs_days")}`}</option>)}</select></label>
      {(["runtimeRetentionDays", "businessRetentionDays", "maxFileBytes", "maxTotalBytes"] as const).map(key => <label key={key} className="flex flex-col gap-1 text-sm">{t(`logs_${key}`)}<input type="number" min={key === "maxTotalBytes" ? 10 : 1} max={key.endsWith("Days") ? 90 : key === "maxFileBytes" ? 100 : 1024} step={key.endsWith("Days") ? 1 : "any"} required className={control} value={settings[key] / (key.endsWith("Bytes") ? 1048576 : 1)} onChange={e => update(key, Number(e.target.value) * (key.endsWith("Bytes") ? 1048576 : 1))} /></label>)}
    </fieldset>
    <p className="text-xs text-gray-500 dark:text-slate-400">{t("logs_retentionNote")}</p>
    <fieldset disabled={busy} className="flex flex-wrap gap-4"><legend className="mb-2 text-sm font-semibold">{t("logs_categorySwitches")}</legend>{Object.entries(LOG_CATEGORIES).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.categories[key as keyof typeof LOG_CATEGORIES]} onChange={e => update("categories", { ...settings.categories, [key]: e.target.checked })} />{locale === "en" ? label.en : label.zh}</label>)}</fieldset>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy} checked={settings.frontendEnabled} onChange={e => update("frontendEnabled", e.target.checked)} />{t("logs_frontend")}</label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy} checked={settings.alertsEnabled} onChange={e => update("alertsEnabled", e.target.checked)} />{t("logs_alerts")}</label>
    <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy} className="rounded-xl bg-[#00C776] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t("logs_save")}</button><button type="button" disabled={busy} onClick={() => perform(true)} className={`${control} disabled:opacity-50`}>{t("logs_cleanup")}</button></div>
    <p className="text-xs text-gray-500 dark:text-slate-400">{t("logs_cleanupScope")}</p>
    <p role="status" className="text-sm">{status}</p>
  </form><ConfirmDialog {...dialogProps} variant={cleanupDialog ? "danger" : "default"} /></>;
}
