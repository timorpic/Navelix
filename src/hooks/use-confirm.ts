"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Promise 风格的确认弹窗 hook —— 用于替换原生 `confirm()`。
 *
 * 动机：项目里 `confirm-dialog.tsx`（受控组件）与原生 `confirm()` 两套并存，
 * 7 处仍用原生弹窗。直接迁移需要在每个调用点各加一对 useState + 一段 JSX，
 * 而这些调用点所在的组件本就有 16~19 个 useState（见审计报告），再加状态会加剧问题。
 *
 * 本 hook 把弹窗状态收在一处，调用点几乎保持原生的写法：
 *
 * ```tsx
 * const confirm = useConfirm();
 * // ...
 * if (!(await confirm({ title: "删除", message: "确定删除？" }))) return;
 * // ...
 * <ConfirmDialog {...confirm.dialogProps} />
 * ```
 */

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface UseConfirmResult {
  /** 打开弹窗并等待用户选择；确认返回 true，取消返回 false */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** 展开到 <ConfirmDialog> 上的属性 */
  dialogProps: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    onClose: () => void;
  };
}

export function useConfirm(): UseConfirmResult {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      // 若上一次弹窗尚未结算，先按「取消」结算，避免 Promise 永久悬挂
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setOptions(next);
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  }, []);

  const handleConfirm = useCallback(() => settle(true), [settle]);
  const handleCancel = useCallback(() => settle(false), [settle]);

  return {
    confirm,
    dialogProps: {
      open: options !== null,
      title: options?.title ?? "",
      message: options?.message ?? "",
      confirmLabel: options?.confirmLabel,
      cancelLabel: options?.cancelLabel,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
      onClose: handleCancel,
    },
  };
}
