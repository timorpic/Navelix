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
