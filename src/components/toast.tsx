"use client";

/**
 * 提示展示组件 —— 对应 `useToast()` 返回的 `notice`。
 *
 * 两种视觉变体（沿用重构前各处的既有样式，未做视觉改动）：
 * - `banner`：内联绿色横幅，用于页面/区块顶部
 * - `toast` ：右上角固定深色浮层
 *
 * 两者均为纯自动消失、无关闭按钮（与重构前行为一致）。
 */

interface ToastProps {
  message: string;
  variant?: "banner" | "toast";
  /** 附加到外层容器的类名，用于还原各调用点原有的间距（如 mb-4、lg:col-span-12） */
  className?: string;
}

export default function Toast({
  message,
  variant = "banner",
  className = "",
}: ToastProps) {
  if (!message) return null;

  if (variant === "toast") {
    return (
      <div className="fixed top-4 right-4 z-50 bg-gray-900 dark:bg-slate-700 text-white text-xs px-4 py-2 rounded-xl shadow-lg">
        {message}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-[#00C776]/30 bg-[#00C776]/10 px-4 py-2.5 text-xs font-semibold text-[#009a5a] shadow-2xs animate-fadeIn ${className}`}
    >
      {message}
    </div>
  );
}
