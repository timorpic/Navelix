"use client";

/**
 * 活动条目图标渲染 —— emoji、图片地址与 data URI 三种形态统一处理。
 *
 * 从 `recent-activities-card.tsx`（原 1002 行）抽出：原先是一个返回 JSX 的普通函数
 * `renderActivityIcon(icon, className)`，被表格行与详情弹窗各调用一次。这里原样
 * 搬成组件，class 与渲染结果完全不变，调用点由函数调用改为 JSX。
 */
export default function ActivityIcon({
  icon,
  className = "w-4 h-4",
}: {
  icon: string;
  className?: string;
}) {
  if (!icon) return <span className="text-sm shrink-0">📌</span>;
  if (
    icon.startsWith("data:image/") ||
    icon.startsWith("http://") ||
    icon.startsWith("https://") ||
    icon.startsWith("/")
  ) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={icon}
        alt=""
        className={`${className} rounded object-contain shrink-0`}
      />
    );
  }
  return <span className="text-sm shrink-0 mt-0.5">{icon}</span>;
}
