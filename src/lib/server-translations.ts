import { createTranslator } from "next-intl";
import zh from "../../messages/zh-CN.json" with { type: "json" };
import en from "../../messages/en.json" with { type: "json" };
import { normalizeLocale } from "./i18n.ts";
import { localizeText } from "./localize-text.ts";

/** Explicit locale: usable by background tasks, with no request or database dependencies. */
export function translateText(locale: unknown, source: string): string {
  const language = normalizeLocale(locale);
  return localizeText(source, createTranslator({ locale: language, messages: (language === "en" ? en : zh) as Record<string, string> }));
}
