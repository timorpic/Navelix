"use client";

import { useTranslations } from "next-intl";
import { useNavelixData } from "@/context/navelix-context";

interface PendingTodo {
  id: string;
  ownerId?: string;
  title: string;
  priority: string;
  dueDate: string;
}

/** 通知弹层小组件：待处理提醒（未完成待办） */
export default function PendingRemindersWidget() {
  const tx = useTranslations();
  const { todos } = useNavelixData();

  const pending: PendingTodo[] = todos
    .filter((t) => !t.done)
    .slice(0, 6)
    .map((t) => ({
      id: t.id,
      ownerId: t.ownerId,
      title: t.title,
      priority: t.priority || "medium",
      dueDate: t.dueDate || "",
    }));

  const priorityColor = (p: string) => {
    if (p === "high") return "bg-rose-500";
    if (p === "low") return "bg-gray-400";
    return "bg-amber-500";
  };

  return (
    <div className="shrink-0 rounded-2xl p-4 bg-white/90 dark:bg-slate-900/70 border border-gray-100 dark:border-slate-700 space-y-3 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-sm">📌</span>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">{tx("pending_reminders_31e81252")}</h3>
        {pending.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-[#00C776]/10 text-[#00C776] text-[9px] font-bold ml-auto">
            {todos.filter(todo => !todo.done).length}
          </span>
        )}
      </div>

      {pending.length === 0 ? (
        <p className="py-3 text-center text-xs text-gray-400 dark:text-slate-500">{tx("nothing_pending_e9f5dfa8")}</p>
      ) : (
        <div className="space-y-1.5">
          {pending.map((todo) => (
            <div key={`${todo.ownerId ?? ""}:${todo.id}`} className="flex items-center gap-2 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityColor(todo.priority)}`} />
              <span className="flex-1 text-xs text-gray-700 dark:text-slate-200 truncate">
                {todo.title}
              </span>
              {todo.dueDate && (
                <span className="text-[9px] text-gray-400 dark:text-slate-500 shrink-0">
                  {todo.dueDate.slice(5)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
