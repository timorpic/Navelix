/**
 * 统一将 Date 对象格式化为本地时区的 YYYY-MM-DD 字符串，
 * 彻底避免 toISOString() 在东八区等时区因 UTC 时间跨天导致的数据偏差与不同步问题。
 */
export function toLocalDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 按指定 IANA 时区格式化日期（服务器时区与用户时区不一致时兜底用，如 Asia/Shanghai）
 */
export function toZonedLocalDateStr(d: Date = new Date(), timeZone = "Asia/Shanghai"): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return toLocalDateStr(d);
  }
}

/**
 * 按照本地日期加减天数并输出 YYYY-MM-DD
 */
export function addDaysLocal(d: Date | string, days: number): string {
  const dateObj = typeof d === "string" ? new Date(d.replace(/-/g, "/")) : new Date(d);
  if (isNaN(dateObj.getTime())) {
    const today = new Date();
    today.setDate(today.getDate() + days);
    return toLocalDateStr(today);
  }
  dateObj.setDate(dateObj.getDate() + days);
  return toLocalDateStr(dateObj);
}

/**
 * 相对时间格式化 —— 收敛此前散落在 4 处的重复实现。
 *
 * 项目里实际存在两种风格，语义不同，故用 `style` 区分而非强行合并：
 * - `"words"`（默认）：`3 分钟前` / `2 小时前` / `5 天前`，超过 `fallbackAfterDays` 天显示日期
 * - `"compact"`：`3m` / `2h` / `5d`，适合空间局促的小组件
 *
 * 两种风格的**天数回退阈值原本不同**（words 为 30 天、compact 为 7 天），
 * 这里统一为默认 30 天，调用方可用 `fallbackAfterDays` 覆盖以保持原有观感。
 */
export function formatRelativeTime(
  timestamp: number,
  options: { style?: "words" | "compact"; fallbackAfterDays?: number } = {},
): string {
  const { style = "words", fallbackAfterDays = 30 } = options;

  const diff = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  const suffix = style === "compact"
    ? { m: "m", h: "h", d: "d" }
    : { m: " 分钟前", h: " 小时前", d: " 天前" };

  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)}${suffix.m}`;
  if (diff < day) return `${Math.floor(diff / hour)}${suffix.h}`;
  if (diff < fallbackAfterDays * day) return `${Math.floor(diff / day)}${suffix.d}`;
  return new Date(timestamp).toLocaleDateString("zh-CN");
}
