"use client";

import { useContext, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { NavelixConfigContext, NavelixDataContext } from "@/context/navelix-context";
import { isLocale } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const config = useContext(NavelixConfigContext);
  const data = useContext(NavelixDataContext);
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const change = async (language: string) => {
    if (!isLocale(language)) return;
    setSaving(true);
    setError(false);
    try {
      if (config && data?.user) await config.changeLanguage(language);
      else {
        const response = await fetch("/api/user/locale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language }) });
        if (!response.ok) throw new Error("Unable to save language");
      }
      startTransition(() => router.refresh());
    } catch { setError(true); } finally { setSaving(false); }
  };
  return (
    <label className="max-w-full inline-flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-slate-300">
      <span>🌐 {locale === "en" ? "Language" : "界面语言"}</span>
      <select aria-label="Language / 界面语言" value={locale} disabled={saving || pending} onChange={event => void change(event.target.value)} className="max-w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-gray-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
        <option value="zh-CN">简体中文</option>
        <option value="en">English</option>
      </select>
      {error && <span role="alert">{locale === "en" ? "Failed to save language. Try again." : "保存语言失败，请重试。"}</span>}
    </label>
  );
}
