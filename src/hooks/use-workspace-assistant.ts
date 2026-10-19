"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useNavelixConfig, useNavelixData } from "@/context/navelix-context";
import { askWorkspaceAssistant, createConversationId, decidePendingDeletion } from "@/lib/client/assistant";
import type { AIChatMessage } from "@/types";

export function useWorkspaceAssistant() {
  const t = useTranslations();
  const { config } = useNavelixConfig();
  const { refreshData } = useNavelixData();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const conversationId = useRef("");
  const request = useRef<AbortController | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const enabled = config.aiCopilotEnabled !== false;
  const show = useCallback(() => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setOpen(true); }, []);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => () => request.current?.abort(), []);

  const send = async (suggestion?: string) => {
    const prompt = (suggestion ?? input).trim();
    if (!enabled || !prompt || request.current) return;
    if (!conversationId.current) conversationId.current = createConversationId();
    const controller = new AbortController(); request.current = controller;
    setMessages(current => [...current, { id: createConversationId(), sender: "user", text: prompt }]);
    setInput(""); setPending(true); setError("");
    try {
      const reply = await askWorkspaceAssistant(prompt, conversationId.current, messages, controller.signal);
      if (!controller.signal.aborted) {
        setMessages(current => [...current, {
          id: createConversationId(), sender: "ai", text: reply.text,
          ...(reply.deletions.length > 0 ? { deletions: reply.deletions, deletionPending: true } : {}),
        }]);
        // Tools update the same Provider state as the rest of the workspace.
        void refreshData();
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error && failure.message ? failure.message : t("network_request_failed_try_again_later_5570b3c9"));
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  };

  /**
   * 确认卡按钮：pendingId + 枚举 decision，不经过模型。
   * 成功后把结果追加为一条系统反馈消息；失败则保留卡片以便重试。
   */
  const decideDeletion = async (messageId: string, pendingId: string, decision: "confirm" | "cancel") => {
    if (request.current) return;
    setMessages(current => current.map(message => message.id === messageId ? { ...message, deletionPending: false } : message));
    setError("");
    try {
      const result = await decidePendingDeletion(pendingId, decision);
      setMessages(current => [...current, { id: createConversationId(), sender: "ai", text: decision === "confirm" ? `✅ ${result.message}` : `🚫 ${result.message}` }]);
      void refreshData();
    } catch (failure) {
      setMessages(current => current.map(message => message.id === messageId ? { ...message, deletionPending: true } : message));
      setError(failure instanceof Error && failure.message ? failure.message : t("network_request_failed_try_again_later_5570b3c9"));
    }
  };

  return { opener, enabled, open: enabled && open, show, close, messages, input, setInput, pending, error, send, decideDeletion };
}
export type WorkspaceAssistantState = ReturnType<typeof useWorkspaceAssistant>;
