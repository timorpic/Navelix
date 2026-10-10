"use client";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /**
   * 层级。默认 `z-50`，与同类弹窗平级——此时**后渲染的覆盖先渲染的**。
   *
   * 若弹窗需要在另一个弹窗之上打开（如备份列表弹窗内触发还原确认框），
   * 必须显式传更高的层级，否则会被后者盖住、用户无法操作。
   * `ConfirmDialog` 即以 `elevated` 使用本组件。
   */
  elevated?: boolean;
}

export default function Modal({ open, title, onClose, children, elevated = false }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 ${elevated ? "z-[60]" : "z-50"} flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fadeIn`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-2xl border border-gray-100 dark:border-slate-700 text-gray-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 dark:text-slate-400 transition-colors hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-600 cursor-pointer"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
