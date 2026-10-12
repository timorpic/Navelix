/** Locale rules shared by the browser, server rendering and background tasks. */
export const locales = ["zh-CN", "en"] as const;
export type Locale = typeof locales[number];
export const LOCALE_COOKIE = "navelix_locale";
export function normalizeLocale(value: unknown): Locale {
  return value === "en" || (typeof value === "string" && /^en-/i.test(value)) ? "en" : "zh-CN";
}
export function isLocale(value: unknown): value is Locale {
  return value === "zh-CN" || value === "en";
}
export function browserLocale(acceptLanguage: string | null): Locale {
  const preferences = (acceptLanguage || "").split(",").map((part, index) => {
    const [tag, ...params] = part.trim().split(";");
    const quality = params.find(p => p.trim().startsWith("q="));
    return { tag, q: quality ? Number(quality.trim().slice(2)) : 1, index };
  }).filter(item => Number.isFinite(item.q) && item.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { tag } of preferences) {
    if (/^en(?:-|$)/i.test(tag)) return "en";
    if (/^zh(?:-|$)/i.test(tag)) return "zh-CN";
  }
  return "zh-CN";
}
