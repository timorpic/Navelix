import { writeLog } from "./events.ts";
import { safeIdentifier } from "./redact.ts";
export function recordAIUsage(data: unknown, model: string): void {
  if (!data || typeof data !== "object" || !("usage" in data) || !data.usage || typeof data.usage !== "object") return;
  const usage = data.usage as Record<string, unknown>;
  const details: Record<string, unknown> = { model: safeIdentifier(model, 80) };
  for (const [target, source] of [["inputTokens", "prompt_tokens"], ["outputTokens", "completion_tokens"], ["totalTokens", "total_tokens"]]) {
    const n = usage[source]; if (typeof n === "number" && Number.isFinite(n) && n >= 0) details[target] = n;
  }
  writeLog({ category: "ai", event: "ai.usage.reported", details });
}
