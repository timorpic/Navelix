"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildTelegramPayload,
  parseTelegramConfig,
  parseTelegramSaveResult,
  type TelegramDraft,
  type TelegramSavePatch,
} from "@/lib/admin-profile";

interface UseAdminTelegramSettingsOptions {
  /** 仅展示 UI 提示（来自 useToast） */
  flash: (msg: string) => void;
}

export interface UseAdminTelegramSettingsResult {
  personalSubscriptions: Record<"notifyTodo" | "notifyAssignment" | "notifyDataTransfer", boolean>;
  togglePersonalSubscription: (key: "notifyTodo" | "notifyAssignment" | "notifyDataTransfer") => void;
  tgEnabled: boolean;
  tgNotifyBackup: boolean;
  tgNotifySystem: boolean;
  tgBotTokenConfigured: boolean;
  tgChatId: string;
  setTgChatId: (v: string) => void;
  tgChatIdConfigured: boolean;
  tgBotTokenInput: string;
  setTgBotTokenInput: (v: string) => void;
  tgTesting: boolean;
  /** 保存配置：传入 patch 时按 patch 提交，否则提交整份表单 */
  tgSave: (patch?: TelegramSavePatch) => Promise<void>;
  /** 开关翻转后按新值保存 */
  toggleTgEnabled: () => void;
  toggleTgNotifyBackup: () => void;
  toggleTgNotifySystem: () => void;
  /** 发送一条 Telegram 测试消息 */
  tgTest: () => Promise<void>;
}

export function useAdminTelegramSettings({
  flash,
}: UseAdminTelegramSettingsOptions): UseAdminTelegramSettingsResult {
  // ── Telegram 通知配置 ──
  const [personalSubscriptions, setPersonalSubscriptions] = useState({ notifyTodo: false, notifyAssignment: false, notifyDataTransfer: false });
  const [tgEnabled, setTgEnabled] = useState(false);
  const [tgNotifyBackup, setTgNotifyBackup] = useState(true);
  const [tgNotifySystem, setTgNotifySystem] = useState(true);
  const [tgBotTokenConfigured, setTgBotTokenConfigured] = useState(false);
  const [tgChatId, setTgChatId] = useState("");
  const [tgChatIdConfigured, setTgChatIdConfigured] = useState(false);
  const [tgBotTokenInput, setTgBotTokenInput] = useState("");
  const [tgTesting, setTgTesting] = useState(false);

  const fetchTelegramConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/user/telegram");
      const data = await res.json();
      const state = parseTelegramConfig(data);
      if (state) {
        setPersonalSubscriptions({ notifyTodo: state.notifyTodo, notifyAssignment: state.notifyAssignment, notifyDataTransfer: state.notifyDataTransfer });
        setTgEnabled(state.enabled);
        setTgNotifyBackup(state.notifyBackup);
        setTgNotifySystem(state.notifySystem);
        setTgBotTokenConfigured(state.botTokenConfigured);
        setTgChatId(state.chatId);
        setTgChatIdConfigured(state.chatIdConfigured);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchTelegramConfig();
    });
  }, [fetchTelegramConfig]);

  const tgSave = useCallback(
    async (patch?: TelegramSavePatch) => {
      const draft: TelegramDraft = {
        ...personalSubscriptions,
        botToken: tgBotTokenInput,
        chatId: tgChatId,
        enabled: tgEnabled,
        notifyBackup: tgNotifyBackup,
        notifySystem: tgNotifySystem,
      };
      try {
        const res = await fetch("/api/user/telegram", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildTelegramPayload(draft, patch)),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          const saved = parseTelegramSaveResult(data);
          if (saved) {
            setTgBotTokenConfigured(saved.botTokenConfigured);
            setTgChatIdConfigured(saved.chatIdConfigured);
            const state = parseTelegramConfig(data);
            if (state) { setPersonalSubscriptions({ notifyTodo: state.notifyTodo, notifyAssignment: state.notifyAssignment, notifyDataTransfer: state.notifyDataTransfer }); setTgEnabled(state.enabled); setTgNotifyBackup(state.notifyBackup); setTgNotifySystem(state.notifySystem); }
          }
          setTgBotTokenInput("");
          flash("✅ Telegram 配置已保存");
        } else {
          await fetchTelegramConfig();
          flash(`❌ ${data.error || "保存失败"}`);
        }
      } catch {
        await fetchTelegramConfig();
        flash("❌ 网络请求失败");
      }
    },
    [
      personalSubscriptions,
      tgBotTokenInput,
      tgChatId,
      tgEnabled,
      tgNotifyBackup,
      tgNotifySystem,
      flash,
      fetchTelegramConfig,
    ],
  );

  const tgTest = useCallback(async () => {
    setTgTesting(true);
    try {
      const res = await fetch("/api/user/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        flash("✅ 测试消息已发送，请检查 Telegram");
      } else {
        flash(`❌ ${data.error || "发送失败"}`);
      }
    } catch {
      flash("❌ 网络请求失败");
    } finally {
      setTgTesting(false);
    }
  }, [flash]);

  const toggleTgEnabled = useCallback(() => {
    const next = !tgEnabled;
    setTgEnabled(next);
    tgSave({ enabled: next });
  }, [tgEnabled, tgSave]);

  const toggleTgNotifyBackup = useCallback(() => {
    const next = !tgNotifyBackup;
    setTgNotifyBackup(next);
    tgSave({ notifyBackup: next });
  }, [tgNotifyBackup, tgSave]);

  const toggleTgNotifySystem = useCallback(() => {
    const next = !tgNotifySystem;
    setTgNotifySystem(next);
    tgSave({ notifySystem: next });
  }, [tgNotifySystem, tgSave]);

  return {
    personalSubscriptions,
    togglePersonalSubscription: (key) => { void tgSave({ [key]: !personalSubscriptions[key] }); },
    tgEnabled,
    tgNotifyBackup,
    tgNotifySystem,
    tgBotTokenConfigured,
    tgChatId,
    setTgChatId,
    tgChatIdConfigured,
    tgBotTokenInput,
    setTgBotTokenInput,
    tgTesting,
    tgSave,
    toggleTgEnabled,
    toggleTgNotifyBackup,
    toggleTgNotifySystem,
    tgTest,
  };
}
