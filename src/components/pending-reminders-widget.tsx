"use client";

import { useNavelixData } from "@/hooks/use-navelix-data";

interface PendingTodo {
  id: string;
  title: string;
  priority: string;
  dueDate: string;
}

/** 右侧侧边栏小组件：待处理提醒（未完成待办） */
export default function PendingRemindersWidget() {
  const { todos } = useNavelixData();

  const pending: PendingTodo[] = todos
    .filter((t) => !t.done)
    .slice(0, 6)
    .map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority || "medium",
      dueDate: t.dueDate || "",
    }));

  const priorityColor = (p: string) => {
    if (p === "high") return "text-rose-500";
    if (p === "low") return "text-gray-400";
    return "text-amber-500";
  };

  return (
    <div className="rounded-2xl p-4 bg-white/90 dark:bg-slate-900/70 border border-gray-100 dark:border-slate-700 shadow-2xs space-y-3 transition-colors">
      <div className="flex items-center gap-2">
        <span className="text-sm">📌</span>
        <h3 className="text-xs font-black text-gray-900 dark:text-white tracking-wide">待处理提醒</h3>
        {pending.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-[#00C776]/10 text-[#00C776] text-[9px] font-bold ml-auto">
            {pending.length}
          </span>
        )}
      </div>

      {pending.length === 0 ? (
        <p className="py-3 text-center text-[10px] text-gray-400 dark:text-slate-500">暂无待处理事项</p>
      ) : (
        <div className="space-y-2">
          {pending.map((todo) => (
            <div key={todo.id} className="flex items-center gap-2 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityColor(todo.priority)}`} />
              <span className="flex-1 text-[11px] text-gray-700 dark:text-slate-200 truncate">
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
