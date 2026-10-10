"use client";

/**
 * 弹窗遮罩层 —— 仅收敛那串在 6 处逐字重复的遮罩 class
 * （`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4`）。
 *
 * 为何不直接用 `Modal`：`Modal` 自带标题栏、关闭按钮与
 * `bg-black/40 backdrop-blur-sm` 遮罩，且内层固定 `max-w-md p-6`。
 * 现有这几处弹窗的内层尺寸 / 内边距 / 标题排布各不相同，
 * 直接改用 `Modal` 会改变视觉与交互。本组件只抽遮罩，
 * 内层由调用方自行决定，因此**不改变任何观感**。
 *
 * 定位：这是「已有弹窗」的样式收敛工具，**不是新建弹窗的首选**。
 * 新弹窗请用 `Modal`（自带标题栏、关闭按钮与点击遮罩关闭）。
 *
 * 注意：本组件**不处理点击遮罩关闭** —— 现有 6 处调用点均由各自的
 * 关闭按钮退出。遮罩是 flex 居中容器，其直接子元素才是被居中的面板，
 * 因此 children 必须直接传入面板元素，不要额外包一层 div。
 */
interface OverlayProps {
  children: React.ReactNode;
}

export default function Overlay({ children }: OverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      {children}
    </div>
  );
}
