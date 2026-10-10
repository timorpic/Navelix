"use client";

import { formatRelativeTime } from "@/lib/date-utils";
import { formatExactTime } from "@/lib/recent-activities";
import type { ActivityItem } from "@/lib/recent-activities";
import Modal from "./modal";
import ActivityIcon from "./activity-icon";

/**
 * 活动详情弹窗 —— 展示图标、标题、精确/相对时间、来源徽标与完整执行日志。
 *
 * 从 `recent-activities-card.tsx`（原 1002 行）抽出。原先用 `Modal` 时把标题栏
 * 与内容内联在卡片尾部，只有「关闭」按钮需要 `setSelectedDetailItem(null)`，
 * 因此这里只收一个 `onClose`。
 */
export default function ActivityDetailModal({
  item,
  onClose,
}: {
  /** 为 null 时弹窗关闭（与原 `open={Boolean(selectedDetailItem)}` 等价） */
  item: ActivityItem | null;
  onClose: () => void;
}) {
  return (
    <Modal open={Boolean(item)} title="活动详情" onClose={onClose}>
      {item && (
        <div className="space-y-4 text-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100 dark:border-slate-800">
            <ActivityIcon icon={item.icon} className="w-7 h-7" />
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                {item.title}
              </h4>
              <p className="text-[11px] text-gray-400 dark:text-slate-400">
                {formatExactTime(item.ts)} (
                {formatRelativeTime(item.ts, { fallbackAfterDays: 7 })})
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="font-bold text-gray-700 dark:text-slate-300">
              来源模块：
            </span>
            <div>
              <span
                className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-semibold ${item.sourceBadgeClass}`}
              >
                {item.sourceLabel}
              </span>
            </div>
          </div>

          {item.detail && (
            <div className="space-y-1.5">
              <span className="font-bold text-gray-700 dark:text-slate-300">
                详细描述与执行日志：
              </span>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/80 border border-gray-100 dark:border-slate-800 text-gray-700 dark:text-slate-200 leading-relaxed break-words font-mono text-[11px] max-h-60 overflow-y-auto">
                {item.detail}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-white font-bold transition-colors cursor-pointer"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
