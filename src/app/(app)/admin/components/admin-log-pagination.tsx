"use client";
import { useTranslations } from "next-intl";
import { LOG_PAGE_SIZES, type LogPageSize } from "@/lib/logging/filter-state";
import { logControl } from "./admin-log-styles";
interface Props {
  pageSize: LogPageSize;
  currentPage: number;
  total: number;
  partial: boolean;
  hasNext: boolean;
  disabled: boolean;
  onPageSizeChange: (size: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}
export default function AdminLogPagination({ pageSize, currentPage, total, partial, hasNext, disabled, onPageSizeChange, onPrevious, onNext }: Props) {
  const t = useTranslations();
  const control = logControl;
  return <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          {t("rows_per_page_d577b91f")}
          <select aria-label={t("rows_per_page_d577b91f")} className={control} value={pageSize} onChange={e => {
            onPageSizeChange(Number(e.target.value));
          }}>
            {LOG_PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        {!disabled && <span role="status" className="text-sm tabular-nums text-gray-500 dark:text-slate-400">{t(partial ? "logs_scannedPageSummary" : "logs_pageSummary", { v0: currentPage, v1: Math.max(1, Math.ceil(total / pageSize)), v2: total })}</span>}
        <button className={control} disabled={currentPage === 1 || disabled} onClick={onPrevious}>{t("logs_previous")}</button><button className={control} disabled={!hasNext || disabled} onClick={onNext}>{t("logs_next")}</button></div>;
}
