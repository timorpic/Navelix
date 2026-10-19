"use client";

import { todoUrl } from "@/lib/todo-url";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { TodoItem, WorkspaceMember } from "@/types";
import type { NavelixDataApi } from "@/context/navelix-context";
import Overlay from "./overlay";

/**
 * 日程事项编辑弹窗（标题 / 截止日期 / 优先级 / 关联项目 / 指派责任人 + 删除）。
 *
 * 从 `calendar-view.tsx`（原 1457 行）抽出 —— 该文件把三个互不相关的弹窗与主视图
 * 塞在一起，其中本弹窗独占 6 个表单 state、1 个保存 handler、1 个删除 handler。
 * 表单状态随组件迁移：弹窗在关闭时卸载，每次打开都是全新初值，无需 effect 同步。
 */
export default function ScheduleEditModal({
  item,
  projects,
  members,
  defaultDateStr,
  onClose,
  onSaved,
  mutateWorkspace,
}: {
  item: TodoItem;
  projects: { id: string; name: string }[];
  members: WorkspaceMember[];
  defaultDateStr: string;
  onClose: () => void;
  /** 保存或删除成功后回调，由父组件负责刷新工作区数据 */
  onSaved: () => void;
  /**
   * 工作区写入口由父组件注入（本组件不直接依赖 Provider）：
   * 渲染测试可在无 Provider 环境下挂载，写操作仍统一携带 expectedRevision。
   */
  mutateWorkspace: NavelixDataApi["mutateWorkspace"];
}) {
  const tx = useTranslations();
  const [title, setTitle] = useState(item.title);
  const [dueDate, setDueDate] = useState(item.dueDate || defaultDateStr);
  const [priority, setPriority] = useState<"high" | "medium" | "low">(
    item.priority || "medium",
  );
  const [projectId, setProjectId] = useState(item.projectId || "");
  const [assigneeId, setAssigneeId] = useState(item.assigneeId || "");
  const [error, setError] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const matchedMember = members.find((m) => m.id === assigneeId);
      const res = await mutateWorkspace(todoUrl(item.id, item.ownerId), {
        method: "PATCH",
        body: {
          title: title.trim(),
          dueDate,
          priority,
          projectId,
          assigneeId,
          assigneeName: matchedMember
            ? matchedMember.displayName || matchedMember.username
            : "",
        },
      });
      if (res.ok) {
        onClose();
        onSaved();
        return;
      }
      // 冲突时保留表单内容，只提示重新提交（Provider 已刷新数据）
      setError(res.conflict ? tx("workspace_save_conflict") : tx("failed_to_save_6309a3bb"));
    } catch {
      setError(tx("failed_to_save_6309a3bb"));
    }
  };

  const handleDelete = async () => {
    try {
      const res = await mutateWorkspace(todoUrl(item.id, item.ownerId), { method: "DELETE" });
      if (!res.ok) {
        setError(res.conflict ? tx("workspace_save_conflict") : tx("failed_to_save_6309a3bb"));
        return;
      }
      onClose();
      onSaved();
    } catch {
      setError(tx("failed_to_save_6309a3bb"));
    }
  };

  return (
    <Overlay>
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-gray-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-gray-900 dark:text-white">
            {tx("edit_schedule_item_69676260")}</h3>
          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-gray-500 mb-1">
              {tx("title_02ebbc76")}</label>
            <input
              type="text"
              required
              name="formTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#00C776]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">
                {tx("due_date_31802424")}</label>
              <input
                type="date"
                name="formDueDate"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">
                {tx("focus_priority_ccc34154")}</label>
              <select
                name="formPriority"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as "high" | "medium" | "low")
                }
                className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl font-bold text-gray-800 dark:text-white"
              >
                <option value="high">{tx("high_morning_focus_adf6f101")}</option>
                <option value="medium">{tx("medium_afternoon_progress_d04b0515")}</option>
                <option value="low">{tx("normal_evening_wrap_up_e0625616")}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">
                {tx("related_project_81b8238f")}</label>
              <select
                name="formProjectId"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-800 dark:text-white"
              >
                <option value="">{tx("no_related_project_46062b1a")}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1">
                {tx("assign_to_1c362011")}</label>
              <select
                name="formAssigneeId"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl font-bold text-gray-800 dark:text-white"
              >
                <option value="">{tx("unassigned_myself_bc4db75f")}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    👤 {m.displayName || m.username}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <p className="text-[11px] text-rose-500">{error}</p>}

          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleDelete}
              className="text-xs text-rose-500 hover:underline font-bold"
            >
              {tx("delete_item_9f1e8663")}</button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
              >
                {tx("cancel_2cd0f3be")}</button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#00C776] text-white text-xs font-bold rounded-xl hover:bg-[#00B068]"
              >
                {tx("save_changes_84b88b0f")}</button>
            </div>
          </div>
        </form>
      </div>
    </Overlay>
  );
}
