"use client";

import Modal from "./modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  /** 取消按钮文案（此前硬编码为英文 "Cancel"） */
  cancelLabel?: string;
  /** 允许返回 Promise：确认期间按钮进入禁用态，避免重复提交 */
  onConfirm: () => void | Promise<void>;
  /** 用户取消（点取消按钮或遮罩）时触发，用于还原调用方的临时状态 */
  onCancel?: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "取消",
  onConfirm,
  onCancel,
  onClose,
}: ConfirmDialogProps) {
  // 确认处理器可能是异步的（如上传还原、删除请求）。
  // 此前实现是 onConfirm(); onClose(); —— 异步不会被等待，弹窗会在请求完成前关闭。
  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onCancel?.();
    onClose();
  };

  return (
    <Modal open={open} title={title} onClose={handleCancel}>
      <p className="text-sm leading-relaxed text-gray-600">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={handleCancel}
          className="h-9 rounded-lg px-4 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
        >
          {cancelLabel}
        </button>
        <button
          onClick={handleConfirm}
          className="h-9 rounded-lg bg-red-500 px-4 text-sm font-medium text-white transition-colors hover:bg-red-600"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
