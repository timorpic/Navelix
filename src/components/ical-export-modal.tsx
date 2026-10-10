"use client";

import Overlay from "./overlay";

/**
 * iCal 订阅与导出弹窗。
 *
 * 从 `calendar-view.tsx`（原 1457 行）抽出 —— 该文件把三个互不相关的弹窗
 * （iCal 导出 / AI 排程建议 / 编辑日程）与主视图塞在一起。本弹窗完全自包含，
 * 只依赖自身的开关状态。
 */
export default function IcalExportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <Overlay>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-gray-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
            <span>📲</span>
            <span>外部日历订阅与导出 (iCal / .ics)</span>
          </h3>
          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
          您可以将 Navelix 中的数字化项目里程碑与待办日程无缝同步至手机
          （Apple 日历、Google 日历、Outlook 等）。
        </p>

        <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 space-y-2">
          <span className="block text-[11px] font-bold text-gray-500 dark:text-slate-400">
            标准 iCalendar 文件下载：
          </span>
          <a
            href="/api/calendar/export"
            download="navelix-schedule.ics"
            className="w-full py-2 bg-[#00C776] hover:bg-[#00B068] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>📥</span>
            <span>下载 navelix-schedule.ics 文件</span>
          </a>
        </div>

        <div className="text-[11px] text-gray-400 space-y-1">
          <p>💡 手机使用方法：</p>
          <p>• iOS: 点击下载后在「文件」中打开，点击「全部添加到日历」；</p>
          <p>• Google/Outlook: 在日历设置中选择「导入日历」即可。</p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-100 dark:bg-slate-800 text-xs font-bold rounded-xl"
          >
            关闭
          </button>
        </div>
      </div>
    </Overlay>
  );
}
