"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  updateCheckFailureResult,
  type UpdateCheckResult,
} from "@/lib/admin-system";

/**
 * 「系统运维与安全」Tab 的版本自检状态（块 4：🔄 版本与更新）。
 *
 * 从 `admin-system-tab.tsx`（原 928 行）抽出 —— 挂载自动检查、按钮手动检查
 * 与结果 state 原先和数据库备份、导入导出等互不相关的设置同处一个组件。
 * 响应解析与失败兜底文案见 `@/lib/admin-system`。
 */
export interface UseAdminUpdateCheckResult {
  checkingUpdate: boolean;
  updateResult: UpdateCheckResult | null;
  /** 按钮手动检查 */
  checkUpdate: () => Promise<void>;
}

export function useAdminUpdateCheck(): UseAdminUpdateCheckResult {
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const autoCheckedUpdateRef = useRef(false);

  // 挂载后自动检查一次（用 ref 防止重复触发）
  useEffect(() => {
    if (autoCheckedUpdateRef.current) return;
    autoCheckedUpdateRef.current = true;
    let cancelled = false;
    fetch("/api/update-check")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setUpdateResult(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const checkUpdate = useCallback(async () => {
    setCheckingUpdate(true);
    try {
      const res = await fetch("/api/update-check");
      const data = await res.json();
      setUpdateResult(data);
    } catch {
      setUpdateResult(updateCheckFailureResult());
    } finally {
      setCheckingUpdate(false);
    }
  }, []);

  return { checkingUpdate, updateResult, checkUpdate };
}
