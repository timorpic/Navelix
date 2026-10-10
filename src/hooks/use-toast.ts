"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pushNotification } from "@/lib/client/notifications";

/**
 * 轻量提示 hook —— 收敛此前在 7 个 admin 文件里各自复制的 `flash` / `notify`。
 *
 * 与既有实现的差异（均为修正）：
 * 1. 用 ref 跟踪定时器并在重新提示时清除，避免「连续两次提示时，第一次的定时器
 *    提前清掉第二条消息」的竞态；
 * 2. 卸载时清除定时器，避免对已卸载组件 setState。
 */

export interface UseToastResult {
  /** 当前提示文案，空串表示无提示 */
  notice: string;
  /** 仅展示 UI 提示 */
  flash: (msg: string, durationMs?: number) => void;
  /** 展示 UI 提示，同时写入持久化通知中心 */
  notify: (title: string, msg: string, durationMs?: number) => void;
  /** 手动清除提示 */
  clear: () => void;
}

export const DEFAULT_TOAST_DURATION_MS = 2800;

export function useToast(defaultDurationMs = DEFAULT_TOAST_DURATION_MS): UseToastResult {
  const [notice, setNotice] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    clearTimer();
    setNotice("");
  }, [clearTimer]);

  const flash = useCallback(
    (msg: string, durationMs = defaultDurationMs) => {
      clearTimer();
      setNotice(msg);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setNotice("");
      }, durationMs);
    },
    [clearTimer, defaultDurationMs],
  );

  const notify = useCallback(
    (title: string, msg: string, durationMs = defaultDurationMs) => {
      flash(msg, durationMs);
      pushNotification(title, msg);
    },
    [flash, defaultDurationMs],
  );

  useEffect(() => clearTimer, [clearTimer]);

  return { notice, flash, notify, clear };
}
