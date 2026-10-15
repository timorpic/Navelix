import type { AIChatMessage } from "../../types/index.ts";

/** Conversation identity must also work on a NAS served over plain HTTP. */
export function createConversationId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, "0")).join("");
}
export async function askWorkspaceAssistant(prompt: string, conversationId: string, history: AIChatMessage[], signal: AbortSignal): Promise<string> {
  const response = await fetch("/api/ai/chat", {
    method: "POST", signal, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, conversationId, history: history.slice(-6) }),
  });
  const data: unknown = await response.json().catch(() => null);
  const body = data && typeof data === "object" ? data as Record<string, unknown> : {};
  if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : "");
  if (typeof body.text !== "string" || !body.text.trim()) throw new Error("");
  return body.text;
}
