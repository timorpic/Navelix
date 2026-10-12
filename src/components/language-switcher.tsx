"use client";

import { useContext, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { NavelixConfigContext, NavelixDataContext } from "@/context/navelix-context";
import { isLocale } from "@/lib/i18n";

/**
 * 界面语言切换控件。
 *
 * 登录、注册与分享页使用默认的内联样式（自带「🌐 界面语言」可见标签）；
 * 后台「界面与功能」页传入 `showLabel={false}`，由所在卡片提供标题与说明，
 * 避免与卡片标题重复。登录后写入个人配置，访客仅写语言 Cookie。
 */
export default function LanguageSwitcher({ showLabel = true }: { showLabel?: boolean }) {
  const locale = useLocale();
  const tx = useTranslations();
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
      {showLabel && <span>🌐 {tx("interface_language_3d138685")}</span>}
      <select aria-label="Language / 界面语言" value={locale} disabled={saving || pending} onChange={event => void change(event.target.value)} className="max-w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-gray-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white cursor-pointer">
        <option value="zh-CN">简体中文</option>
        <option value="en">English</option>
      </select>
      {error && <span role="alert">{tx("failed_to_save_language_please_try_again__d424186b")}</span>}
    </label>
  );
}
