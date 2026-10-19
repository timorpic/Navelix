import type { AIChatMessage } from "../../types/index.ts";

/** Conversation identity must also work on a NAS served over plain HTTP. */
export function createConversationId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, "0")).join("");
}
export interface PendingDeletion {
  pendingId: string;
  targetName: string;
  message: string;
}

export interface AssistantReply {
  text: string;
  /** 本次回复暂存的删除请求；前端据此渲染确认卡 */
  deletions: PendingDeletion[];
}

function parseDeletions(value: unknown): PendingDeletion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const { pendingId, targetName, message } = item as Record<string, unknown>;
    if (typeof pendingId !== "string" || !/^[a-f0-9]{32}$/.test(pendingId)) return [];
    return [{ pendingId, targetName: typeof targetName === "string" ? targetName : "", message: typeof message === "string" ? message : "" }];
  });
}

export async function askWorkspaceAssistant(prompt: string, conversationId: string, history: AIChatMessage[], signal: AbortSignal): Promise<AssistantReply> {
  const response = await fetch("/api/ai/chat", {
    method: "POST", signal, headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, conversationId, history: history.slice(-6) }),
  });
  const data: unknown = await response.json().catch(() => null);
  const body = data && typeof data === "object" ? data as Record<string, unknown> : {};
  if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : "");
  if (typeof body.text !== "string" || !body.text.trim()) throw new Error("");
  return { text: body.text, deletions: parseDeletions(body.deletions) };
}

/** 确定性确认：只发送枚举 decision，不解析自然语言。 */
export async function decidePendingDeletion(pendingId: string, decision: "confirm" | "cancel"): Promise<{ message: string }> {
  const response = await fetch("/api/ai/confirm-delete", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pendingId, decision }),
  });
  const data: unknown = await response.json().catch(() => null);
  const body = data && typeof data === "object" ? data as Record<string, unknown> : {};
  if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : "");
  return { message: typeof body.message === "string" ? body.message : "" };
}
