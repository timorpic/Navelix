import type { LogEvent } from "./types.ts";
export function summarizeLogs(logs: LogEvent[], now = Date.now()) {
  const categories: Record<string, number> = {};
  const errors: Record<string, number> = {};
  const start = Math.floor(now / 3600000) * 3600000 - 23 * 3600000;
  const trend = Array.from({ length: 24 }, (_, i) => ({ time: start + i * 3600000, count: 0, errors: 0 }));
  for (const event of logs) {
    const count = typeof event.details.occurrences === "number" ? event.details.occurrences : 1;
    categories[event.category] = (categories[event.category] ?? 0) + count;
    const error = event.level === "error" || event.level === "warn";
    if (error) errors[event.event] = (errors[event.event] ?? 0) + count;
    const bucket = trend[Math.floor((event.timestamp - start) / 3600000)];
    if (bucket) { bucket.count += count; if (error) bucket.errors += count; }
  }
  return { categories, trend, errors: Object.entries(errors).map(([event, count]) => ({ event, count })).sort((a, b) => b.count - a.count).slice(0, 10) };
}
