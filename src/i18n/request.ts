import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { getUserConfigRow } from "@/lib/global-config";
import { browserLocale, isLocale, LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n";

export default getRequestConfig(async () => {
  const user = await getSessionUser();
  const cookieStore = await cookies();
  const saved = cookieStore.get(LOCALE_COOKIE)?.value;
  // A public workspace owner's preference must never override the viewer's language.
  const locale = user ? normalizeLocale(getUserConfigRow(user.id)?.language)
    : isLocale(saved) ? saved : browserLocale((await headers()).get("accept-language"));
  const defaults = (await import("../../messages/zh-CN.json")).default;
  const messages = locale === "en" ? { ...defaults, ...(await import("../../messages/en.json")).default } : defaults;
  return { locale, messages, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
});
