"use client";
import { useLocale, useTranslations } from "next-intl";
import { LOG_CATEGORIES } from "@/lib/logging/types";
import { LOG_SELECT_OPTIONS, type LogFilterDraft } from "@/lib/logging/filter-state";
import { logControl } from "./admin-log-styles";
interface Props {
  draft: LogFilterDraft;
  onChange: (draft: LogFilterDraft) => void;
  onApply: () => void;
  onCategory: (category: string) => void;
}
export default function AdminLogFilters({ draft, onChange, onApply, onCategory }: Props) {
  const t = useTranslations(); const locale = useLocale();
  const control = logControl;
  return <>      <div className="flex flex-wrap gap-2" aria-label={t("logs_category")}>{[{ value: "", name: { zh: "全部功能", en: "All functions" } }, ...Object.entries(LOG_CATEGORIES).map(([value, name]) => ({ value, name }))].map(({ value, name }) => { return <button key={value} aria-pressed={draft.category === value} className={`rounded-xl px-3 py-2 text-sm transition-colors ${draft.category === value ? "bg-[#00C776] text-white" : "bg-gray-50 dark:bg-slate-900 text-gray-600 dark:text-slate-400"}`} onClick={() => onCategory(value)}>{locale === "en" ? name.en : name.zh}</button>; })}</div>
      <form onSubmit={e => { e.preventDefault(); onApply(); }} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs">{t("logs_range")}<select className={control} value={draft.hours} onChange={e => onChange({ ...draft, hours: e.target.value })}>{[1, 24, 168, 720, 8760].map(hours => <option value={hours} key={hours}>{hours < 24 ? `1 ${t("logs_hour")}` : `${hours / 24} ${t("logs_days")}`}</option>)}</select></label>
        {(["level", "outcome", "kind", "source"] as const).map(key => <label key={key} className="flex flex-col gap-1 text-xs">{t(`logs_${key}`)}<select aria-label={t(`logs_${key}`)} className={control} value={draft[key]} onChange={e => onChange({ ...draft, [key]: e.target.value })}><option value="">{t("logs_all")}</option>{(LOG_SELECT_OPTIONS[key]).map(value => <option key={value} value={value}>{value === "error" ? t("logs_levelError") : value === "frontend" ? t("logs_sourceFrontend") : t.has(`logs_${value}`) ? t(`logs_${value}`) : value}</option>)}</select></label>)}
        {(["q", "module", "actorId", "event", "requestId", "operationId"] as const).map(key => <label key={key} className="flex flex-col gap-1 text-xs">{t(`logs_${key}`)}<input className={control} maxLength={160} value={draft[key]} onChange={e => onChange({ ...draft, [key]: e.target.value })} /></label>)}
        {(["start", "end"] as const).map(key => <label key={key} className="flex flex-col gap-1 text-xs">{t(`logs_${key}`)}<input type="datetime-local" className={control} value={draft[key]} onChange={e => onChange({ ...draft, [key]: e.target.value })} /></label>)}
        <button className="self-end rounded-xl bg-[#00C776] px-4 py-2 text-sm font-semibold text-white">{t("logs_filter")}</button>
      </form></>;
}
