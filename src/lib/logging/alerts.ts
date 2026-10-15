import type { LogEvent } from "./types.ts";
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
    const threshold = /migration|storage|disk|encryption/.test(event.event) ? 1 : 3;
    if (state.failures < threshold || state.nextAlert > Date.now()) return;
    state.notified = true; state.nextAlert = Date.now() + 30 * 60_000;
    void send(`Navelix: ${event.event}\n${event.code}\nOperation: ${event.operationId || event.requestId}`).catch(() => {});
  };
}
