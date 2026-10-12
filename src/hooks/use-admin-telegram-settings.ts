"use client";

import { useTranslations } from "next-intl";
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
  const tx = useTranslations();
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
          flash(tx("telegram_settings_saved_a4e53d9c"));
        } else {
          await fetchTelegramConfig();
          flash(`❌ ${data.message || data.error || tx("failed_to_save_6309a3bb")}`);
        }
      } catch {
        await fetchTelegramConfig();
        flash(tx("network_request_failed_32fed512"));
      }
    },
    [personalSubscriptions, tgBotTokenInput, tgChatId, tgEnabled, tgNotifyBackup, tgNotifySystem, flash, fetchTelegramConfig, tx],
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
        flash(tx("test_message_sent_check_telegram_3ef13016"));
      } else {
        flash(`❌ ${data.message || data.error || tx("failed_to_send_ac77953a")}`);
      }
    } catch {
      flash(tx("network_request_failed_32fed512"));
    } finally {
      setTgTesting(false);
    }
  }, [flash, tx]);

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
