"use client";

import { useTranslations } from "next-intl";
import { accountSocialLinks } from "@/lib/social-links";
import type { SystemConfig } from "@/types";

export default function AccountSocialLinks({ config }: { config: SystemConfig }) {
  const t = useTranslations();
  const links = accountSocialLinks(config);
  if (!links.length) return null;
  return <nav aria-label={t("social_contact_258de35f")} className="w-full px-3 py-2 text-left"><p className="mb-1 text-[10px] font-medium text-gray-400 dark:text-slate-400">{t("social_contact_258de35f")}</p><div className="flex flex-wrap gap-x-3 gap-y-1">{links.map(link => <a key={link.label} href={link.href} target={link.href.startsWith("mailto:") ? undefined : "_blank"} rel="noopener noreferrer" className="inline-flex min-h-9 items-center rounded text-xs font-medium text-gray-600 transition-colors hover:text-[#00A561] focus-visible:outline-2 focus-visible:outline-[#00C776] dark:text-slate-300 dark:hover:text-[#00C776]">{link.label}</a>)}</div></nav>;
}
