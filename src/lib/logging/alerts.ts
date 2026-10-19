import type { LogEvent } from "./types.ts";

/**
 * 需要立即告警（阈值 1）的事件前缀，其余按连续失败 3 次告警。
 *
 * 原实现用 `/migration|storage|disk|encryption/.test(event.event)` 对事件名做
 * 自由文本包含匹配：任意位置出现这些子串都会触发，新增事件名时容易误判或漏判。
 * 这里改为在固定前缀清单内匹配 —— 前缀由代码定义，是稳定契约；
 * 新增关键事件时只需在此登记一行。
 */
const IMMEDIATE_EVENT_PREFIXES = [
  "database.migration.",
  "logs.storage.",
  "backup.cloud.storage.",
  "security.encryption.",
] as const;

/** In-process aggregation; recipients and subscriptions are checked by the injected sender. */
export function createLogAlerts(send: (message: string) => Promise<unknown>) {
  const modules = new Map<string, { failures: number; notified: boolean; nextAlert: number }>();
  return (event: LogEvent): void => {
    if (event.category === "notification" || event.source === "frontend") return;
    const key = `${event.category}:${event.module}`;
    const state = modules.get(key) ?? { failures: 0, notified: false, nextAlert: 0 };
    if (modules.size >= 100 && !modules.has(key)) modules.delete(modules.keys().next().value!);
    modules.set(key, state);
    if (event.outcome === "succeeded") {
      if (state.notified) void send(`Navelix recovered: ${event.category} / ${event.module}`).catch(() => {});
      state.failures = 0; state.notified = false; return;
    }
    if (event.level !== "error" || event.outcome !== "failed") return;
    state.failures++;
    const critical = IMMEDIATE_EVENT_PREFIXES.some((prefix) => event.event.startsWith(prefix));
    const threshold = critical ? 1 : 3;
    if (state.failures < threshold || state.nextAlert > Date.now()) return;
    state.notified = true; state.nextAlert = Date.now() + 30 * 60_000;
    void send(`Navelix: ${event.event}\n${event.code}\nOperation: ${event.operationId || event.requestId}`).catch(() => {});
  };
}
