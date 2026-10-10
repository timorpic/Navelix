"use client";

import Overlay from "./overlay";
import type { AiScheduledTask } from "@/hooks/use-ai-schedule";

/**
 * AI 排程建议弹窗。
 *
 * 从 `calendar-view.tsx`（原 1457 行）抽出。状态与操作全部来自
 * `useAiSchedule()`，本组件只负责展示与转发事件。
 */
export default function AiScheduleModal({
  open,
  onClose,
  dateLabel,
  advice,
  warning,
  tasks,
  selectedIndices,
  planning,
  applying,
  onToggleIndex,
  onUpdateTitle,
  onUpdatePriority,
  onDeleteTask,
  onAddCustomTask,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  dateLabel: string;
  advice: string;
  /** 校验/写入失败提示（替代原先的 alert()） */
  warning: string;
  tasks: AiScheduledTask[];
  selectedIndices: Set<number>;
  planning: boolean;
  applying: boolean;
  onToggleIndex: (index: number) => void;
  onUpdateTitle: (index: number, title: string) => void;
  onUpdatePriority: (index: number, priority: "high" | "medium" | "low") => void;
  onDeleteTask: (index: number) => void;
  onAddCustomTask: () => void;
  onApply: () => void;
}) {
  if (!open) return null;

  return (
    <Overlay>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-gray-100 dark:border-slate-800 space-y-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-base">✨</span>
            <div>
              <h3 className="text-sm font-black text-gray-900 dark:text-white">
                AI Copilot 智能排程建议
              </h3>
              <p className="text-[11px] text-gray-400">
                针对 {dateLabel} 智能规划精力时段与执行里程碑
              </p>
            </div>
          </div>
          <button
            onClick={() => onClose()}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {planning ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-gray-400">
            <span className="animate-spin text-2xl">⏳</span>
            <span className="text-xs font-bold">
              AI Copilot 正在深度分析您的工作区与项目状态，规划排期中...
            </span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            {warning && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900 text-xs font-semibold text-rose-600 dark:text-rose-400">
                {warning}
              </div>
            )}

            {/* 建议策略 */}
            {advice && (
              <div className="p-3 rounded-xl bg-[#00C776]/10 border border-[#00C776]/30 text-xs text-gray-800 dark:text-slate-200">
                <p className="font-semibold">{advice}</p>
              </div>
            )}

            {/* 任务清单 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-gray-700 dark:text-slate-300">
                <span>
                  规划任务列表 (已选 {selectedIndices.size}/{tasks.length})
                </span>
                <button
                  type="button"
                  onClick={onAddCustomTask}
                  className="text-xs text-[#00C776] hover:underline font-bold cursor-pointer"
                >
                  + 补充任务
                </button>
              </div>

              {tasks.map((task, idx) => {
                const isChecked = selectedIndices.has(idx);
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                      isChecked
                        ? "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 shadow-2xs"
                        : "bg-gray-50/50 dark:bg-slate-900/40 border-gray-100 dark:border-slate-800 opacity-60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleIndex(idx)}
                      className="w-4 h-4 rounded text-[#00C776] focus:ring-[#00C776] cursor-pointer"
                    />

                    {/* 任务名称 */}
                    <input
                      type="text"
                      name="aiTaskTitle"
                      value={task.title}
                      onChange={(e) =>
                        onUpdateTitle(idx, e.target.value)
                      }
                      className="flex-1 px-2 py-1 text-xs bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-800 dark:text-white"
                    />

                    {/* 优先级 */}
                    <select
                      name="aiTaskPriority"
                      value={task.priority}
                      onChange={(e) =>
                        onUpdatePriority(
                          idx,
                          e.target.value as "high" | "medium" | "low",
                        )
                      }
                      className="px-2 py-1 text-xs font-bold bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg cursor-pointer"
                    >
                      <option value="high">🌅 高优</option>
                      <option value="medium">☀️ 中优</option>
                      <option value="low">🌙 普通</option>
                    </select>

                    {/* 删除 */}
                    <button
                      type="button"
                      onClick={() => onDeleteTask(idx)}
                      className="p-1 text-gray-400 hover:text-rose-500 text-xs"
                      title="移除此项"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800">
          <span className="text-[11px] text-gray-400">
            采纳后将自动同步写入系统待办并投射至日历
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-3.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 font-bold"
            >
              取消
            </button>
            <button
              type="button"
              disabled={planning || applying || selectedIndices.size === 0}
              onClick={onApply}
              className="px-4 py-1.5 bg-[#00C776] hover:bg-[#00B068] text-white text-xs font-black rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>{applying ? "写入中..." : "一键采纳并写入日历 🗓️"}</span>
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
