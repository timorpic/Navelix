"use client";

import { useState } from "react";
import Modal from "@/components/modal";
import { toLocalDateStr } from "@/lib/date-utils";

interface AddTodoModalProps {
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

const PRIORITIES = [
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
] as const;

/**
 * 快速新建待办模态框。
 * 供 PWA 快捷方式（?action=quick-add-todo）等外部入口唤起；
 * 提交走 POST /api/todos，成功后派发 navelix-workspace-updated 触发全局刷新。
 *
 * 表单状态在挂载时初始化；调用方通过变更 `key` 让每次打开都拿到全新表单。
 */
export default function AddTodoModal({ open, onClose, onAdded }: AddTodoModalProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [dueDate, setDueDate] = useState(() => toLocalDateStr());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed, priority, dueDate }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "创建失败，请重试");
        return;
      }
      window.dispatchEvent(new CustomEvent("navelix-workspace-updated"));
      onAdded?.();
      onClose();
    } catch {
      setError("网络异常，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} title="☑️ 快速记待办" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">
            待办内容
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="要做什么？"
            autoFocus
            className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#00C776] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">
              优先级
            </label>
            <select
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as "high" | "medium" | "low")
              }
              className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#00C776] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">
              截止日期
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#00C776] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs text-gray-500 transition-colors hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!title.trim() || submitting}
            className="rounded-lg bg-[#00C776] px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#00B068] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "创建中…" : "创建"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
