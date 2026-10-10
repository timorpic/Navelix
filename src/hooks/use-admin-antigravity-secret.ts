"use client";

import { useCallback, useEffect, useState } from "react";
import {
  antigravitySaveNotice,
  normalizeAntigravitySecret,
  parseAntigravitySaveResult,
  parseAntigravitySettings,
} from "@/lib/admin-system";

/**
 * 「系统运维与安全」Tab 的反重力 OAuth 客户端密钥状态（块 3：🔐 反重力 OAuth 配置）。
 *
 * 从 `admin-system-tab.tsx`（原 928 行）抽出 —— 密钥状态读取、失焦保存与
 * 卡片内联提示原先混在版本自检、数据库备份等无关状态里。响应解析与
 * 归一化见 `@/lib/admin-system`。
 */
export interface UseAdminAntigravitySecretOptions {
  /** 展示 UI 提示并写入通知中心（来自 useToast） */
  notify: (title: string, msg: string) => void;
}

export interface UseAdminAntigravitySecretResult {
  isCustomAntigravitySecret: boolean;
  /** 卡片内联提示（保存成功 / 失败） */
  antigravityNotice: string;
  /** 保存密钥（留空则忽略）；失焦时传入输入框当前值 */
  saveAntigravitySecret: (secret?: string) => Promise<void>;
}

export function useAdminAntigravitySecret({
  notify,
}: UseAdminAntigravitySecretOptions): UseAdminAntigravitySecretResult {
  const [isCustomAntigravitySecret, setIsCustomAntigravitySecret] = useState(false);
  const [antigravityNotice, setAntigravityNotice] = useState("");

  // 读取系统级配置状态（是否已配置自定义密钥）
  useEffect(() => {
    fetch("/api/admin/system-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const state = parseAntigravitySettings(data);
        if (state) setIsCustomAntigravitySecret(state.isCustomSecret);
      })
      .catch(() => {});
  }, []);

  const saveAntigravitySecret = useCallback(
    async (secret?: string) => {
      const value = normalizeAntigravitySecret(secret ?? "");
      if (!value) return;
      try {
        const res = await fetch("/api/admin/system-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ antigravityClientSecret: value }),
        });
        const data = await res.json();
        setAntigravityNotice(antigravitySaveNotice(res.ok, data));
        if (res.ok) {
          setIsCustomAntigravitySecret(parseAntigravitySaveResult(data).isCustomSecret);
          notify("系统设置", "反重力 OAuth 客户端密钥已保存");
        }
      } catch {
        setAntigravityNotice("❌ 保存失败");
      } finally {
        setTimeout(() => setAntigravityNotice(""), 4000);
      }
    },
    [notify],
  );

  return { isCustomAntigravitySecret, antigravityNotice, saveAntigravitySecret };
}
