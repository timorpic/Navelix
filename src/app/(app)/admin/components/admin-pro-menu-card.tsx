"use client";

import { useTranslations } from "next-intl";
import { useNavelixConfig } from "@/context/navelix-context";

export default function AdminProMenuCard() {
  const tx = useTranslations();
  const { config, updateConfig } = useNavelixConfig();
  const enabled = config.showProMenus !== false;
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white">{tx("pro_menu_visibility_7d40fa97")}</h3>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">{tx("show_pro_feature_menus_c278235f")}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            {tx("applies_site_wide_when_off_hides_branding_custom_99934915")}</p>
        </div>
        <button type="button" role="switch" aria-label={tx("show_pro_feature_menus_c278235f")} aria-checked={enabled}
          onClick={() => updateConfig({ showProMenus: !enabled })}
          className={`relative h-6 w-11 shrink-0 rounded-full cursor-pointer transition-colors ${enabled ? "bg-brand" : "bg-gray-300 dark:bg-slate-600"}`}>
          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>
    </section>
  );
}
