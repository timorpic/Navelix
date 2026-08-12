"use client";

import Modal from "./modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-sm leading-relaxed text-gray-600">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onClose}
          className="h-9 rounded-lg px-4 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className="h-9 rounded-lg bg-red-500 px-4 text-sm font-medium text-white transition-colors hover:bg-red-600"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
