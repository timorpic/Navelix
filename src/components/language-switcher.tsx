"use client";

import { useContext, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { NavelixConfigContext, NavelixDataContext } from "@/context/navelix-context";
import { isLocale } from "@/lib/i18n";

/**
 * 界面语言切换控件。
 *
 * 后台「界面与功能」页传入 `showLabel={false}`，由所在卡片提供标题与说明，
 * 避免与卡片标题重复。登录、注册页整页为固定浅色设计（不使用 dark: 变体），
 * 但根布局会按系统主题给 <html> 加 .dark，故这两处传入 `appearance="light"`
 * 固定为浅色，避免深色下拉框落在白色卡片上。分享页与后台跟随主题。
 * 登录后写入个人配置，访客仅写语言 Cookie。
 */
export default function LanguageSwitcher({
  showLabel = true,
  appearance = "auto",
}: {
  showLabel?: boolean;
  appearance?: "auto" | "light";
}) {
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
  const fixedLight = appearance === "light";
  return (
    <label className={`max-w-full inline-flex flex-wrap items-center gap-2 text-xs ${fixedLight ? "text-gray-600" : "text-gray-600 dark:text-slate-300"}`}>
      {showLabel && <span>🌐 {tx("interface_language_3d138685")}</span>}
      <select
        aria-label="Language / 界面语言"
        value={locale}
        disabled={saving || pending}
        onChange={event => void change(event.target.value)}
        className={`max-w-full rounded-lg border px-2 py-1.5 cursor-pointer ${
          fixedLight
            ? "border-gray-200 bg-white text-gray-900"
            : "border-gray-200 bg-white text-gray-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        }`}
      >
        <option value="zh-CN">简体中文</option>
        <option value="en">English</option>
      </select>
      {error && <span role="alert">{tx("failed_to_save_language_please_try_again__d424186b")}</span>}
    </label>
  );
}
