"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { useNavelixData } from "@/context/navelix-context";
import { useAdminDataTransfer } from "@/hooks/use-admin-data-transfer";
import { useToast } from "@/hooks/use-toast";
import Toast from "@/components/toast";
import SunPanelImportResult from "@/components/sun-panel-import-result";

export default function MigrationOnboarding() {
  const tx = useTranslations();
  const { user, links } = useNavelixData();
  const { notice, flash, notify } = useToast();
  const transfer = useAdminDataTransfer({ flash, notify });
  const sunPanel = useRef<HTMLInputElement>(null);
  const bookmarks = useRef<HTMLInputElement>(null);
  if (!user) return null;
  return <>
    <Toast message={notice} />
    {(links.length === 0 || transfer.importing) && <section aria-labelledby="migration-heading" className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-2xs dark:border-emerald-900 dark:bg-slate-900">
      <h2 id="migration-heading" className="font-bold text-gray-900 dark:text-white">{tx("sun_panel_onboarding_title")}</h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">{tx("sun_panel_onboarding_description")}</p>
      <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">{tx("sun_panel_merge_trust")}</p>
      <input ref={sunPanel} className="hidden" type="file" accept=".json,application/json" aria-label={tx("choose_sun_panel_json_d8b45a9d")} onChange={event => { const file = event.target.files?.[0]; if (file) transfer.importSunPanel(file, event.target); }} />
      <input ref={bookmarks} className="hidden" type="file" accept=".html,text/html" aria-label={tx("choose_html_bookmarks_1e65810e")} onChange={event => { const file = event.target.files?.[0]; if (file) transfer.importBookmarks(file, event.target); }} />
      <div className="mt-4 flex flex-wrap gap-3">
        <button disabled={transfer.importing} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50" onClick={() => sunPanel.current?.click()}>{tx("choose_sun_panel_json_d8b45a9d")}</button>
        <button disabled={transfer.importing} className="rounded-xl border border-gray-200 px-4 py-2 text-sm dark:border-slate-700 disabled:opacity-50" onClick={() => bookmarks.current?.click()}>{tx("migration_browser_bookmarks")}</button>
      </div>
      {transfer.importing && <p role="status" className="mt-3 text-sm">{tx("navigation_import_saving")}</p>}
    </section>}
    <SunPanelImportResult transfer={transfer} />
  </>;
}
