"use client";

import { useText } from "@/hooks/use-text";
import { useTranslations } from "next-intl";
import { eeDriverStatusLabel, eeDriverStatusDescription, type EEDriverStatus } from "@/lib/ee-driver-status";

export default function AdminProEEDriverCard({ status, loading, error, onRefresh }: {
  status: EEDriverStatus | null;
  loading: boolean;
  error: boolean;
  onRefresh: () => Promise<void>;
}) {
  const text = useText();
  const tx = useTranslations();
  const visible = !loading && !error ? status : null;
  const label = loading ? tx("checking_8bbb3856") : error ? tx("status_check_failed_0a932500") : status ? text(eeDriverStatusLabel(status.state)) : tx("load_status_unknown_c8e83cec");
  return (
    <section aria-labelledby="ee-driver-heading" className="rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800/90 p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id="ee-driver-heading" className="text-base font-bold text-gray-900 dark:text-white">{tx("ee_driver_status_0732bbf5")}</h3>
        <button type="button" disabled={loading} onClick={() => void onRefresh()} className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 disabled:opacity-50 cursor-pointer">{tx("refresh_status_802a407c")}</button>
      </div>
      <p data-testid="ee-driver-state" role="status" className={`text-sm font-semibold ${visible?.state === "loaded" ? "text-emerald-700 dark:text-emerald-300" : "text-gray-700 dark:text-slate-200"}`}>{label}</p>
      {visible && <dl className="grid gap-3 sm:grid-cols-2 text-xs text-gray-600 dark:text-slate-300">
        <div><dt className="font-semibold">{tx("storage_driver_s3_webdav_fca374c4")}</dt><dd className="mt-1">{visible.storageRegistered ? tx("registered_1f4273ca") : tx("not_registered_7b89c509")}</dd></div>
        <div><dt className="font-semibold">{tx("network_probe_driver_02257375")}</dt><dd className="mt-1">{visible.probeRegistered ? tx("registered_1f4273ca") : tx("not_registered_7b89c509")}</dd></div>
      </dl>}
      <p className="text-xs leading-relaxed text-gray-500 dark:text-slate-400">
        {loading ? tx("reading_the_actual_driver_status_from_the_server_564c0d8f") : error ? tx("unable_to_retrieve_driver_status_please_try_agai_7c178fdf") : visible ? text(eeDriverStatusDescription(visible)) : tx("refresh_to_retrieve_driver_status_64098459")}
      </p>
    </section>
  );
}
