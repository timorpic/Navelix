"use client";

import type { UseAiBreakdownResult, AssignableMember } from "@/hooks/use-ai-breakdown";

/**
 * AI 项目拆解的任务预览与微调卡片（增删任务 / 改标题 / 调优先级与截止日 / 指派责任人）。
 *
 * 从 `projects-view.tsx`（原 1501 行）抽出 —— 草稿状态与全部编辑操作来自
 * `useAiBreakdown()`，本组件只负责渲染与事件转发。
 */
export default function AiBreakdownCard({
  ai,
  members,
  isEditing,
}: {
  ai: UseAiBreakdownResult;
  members: AssignableMember[];
  /** 编辑已有项目时文案不同（追加阶段任务 vs 新建拆解） */
  isEditing: boolean;
}) {
  if (ai.tasks.length === 0) return null;

  return (
    <div className="p-4 rounded-xl bg-[#00C776]/5 border border-[#00C776]/30 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <h4 className="text-xs font-black text-gray-900 dark:text-white">
            {isEditing
              ? "AI 为当前项目追加阶段任务与排期"
              : "AI 里程碑任务拆解与团队指派预览"}
          </h4>
          <span className="text-[11px] text-gray-500 dark:text-slate-400">
            (共 {ai.tasks.length} 个阶段)
          </span>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-slate-300 font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={ai.syncToCalendar}
              onChange={(e) => ai.setSyncToCalendar(e.target.checked)}
              className="w-4 h-4 rounded text-[#00C776] focus:ring-[#00C776]"
            />
            <span>自动同步写入日历日程 🗓️</span>
          </label>
        </div>
      </div>

      {ai.warning && (
        <p className="text-[11px] text-rose-500 font-medium">{ai.warning}</p>
      )}

      {ai.notice && (
        <p className="text-[11px] text-[#00C776] font-medium">
          {ai.notice}
        </p>
      )}

      {/* 拆解任务列表 */}
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {ai.tasks.map((task, idx) => (
          <div
            key={idx}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-gray-200/70 dark:border-slate-700 shadow-2xs"
          >
            <span className="w-5 h-5 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 text-[10px] font-black flex items-center justify-center shrink-0">
              {idx + 1}
            </span>

            {/* 任务名称输入 */}
            <input
              type="text"
              name="projectTaskTitle"
              value={task.title}
              onChange={(e) => ai.updateTitle(idx, e.target.value)}
              placeholder="任务名称..."
              className="flex-1 px-2.5 py-1 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-[#00C776]"
            />

            {/* 指派责任人 */}
            {members.length > 0 && (
              <select
                name="projectTaskAssignee"
                value={task.assigneeId || ""}
                onChange={(e) =>
                  ai.updateAssignee(idx, e.target.value)
                }
                className="px-2 py-1 text-xs font-bold rounded-lg border bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 cursor-pointer max-w-[110px] truncate"
                title="指派责任人"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    👤 {m.displayName || m.username}
                  </option>
                ))}
              </select>
            )}

            {/* 优先级选择 */}
            <select
              name="projectTaskPriority"
              value={task.priority}
              onChange={(e) =>
                ai.updatePriority(
                  idx,
                  e.target.value as "high" | "medium" | "low",
                )
              }
              className={`px-2 py-1 text-xs font-bold rounded-lg border cursor-pointer ${
                task.priority === "high"
                  ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/60 dark:text-rose-400"
                  : task.priority === "low"
                  ? "bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-slate-400"
                  : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400"
              }`}
            >
              <option value="high">高优</option>
              <option value="medium">中优</option>
              <option value="low">普通</option>
            </select>

            {/* 截止日期 */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-gray-400">
                截止:
              </span>
              <input
                type="date"
                name="projectTaskDueDate"
                value={task.dueDate}
                onChange={(e) =>
                  ai.updateDueDate(idx, e.target.value)
                }
                className="px-2 py-1 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-800 dark:text-slate-100 cursor-pointer"
              />
            </div>

            {/* 删除按钮 */}
            <button
              type="button"
              onClick={() => ai.removeTask(idx)}
              className="p-1 text-gray-400 hover:text-rose-500 text-xs cursor-pointer"
              title="删除此项"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center pt-1">
        <button
          type="button"
          onClick={ai.addTask}
          className="text-xs text-[#00C776] hover:underline font-bold flex items-center gap-1 cursor-pointer"
        >
          <span>+</span>
          <span>添加自定义阶段任务</span>
        </button>
        <span className="text-[11px] text-gray-400">
          可自由增删、指派责任人与调整排期
        </span>
      </div>
    </div>
  
  );
}
