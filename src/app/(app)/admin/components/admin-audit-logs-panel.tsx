"use client";

import { useCallback, useEffect, useState } from "react";

interface AuditLogItem {
  id: string;
  userId: string;
  action: string;
  target: string;
  ip: string;
  details: string;
  createdAt: number;
  username: string;
  displayName: string;
}

const PAGE_SIZE = 50;

/** 动作 → 中文标签（未命名的动作原样显示） */
const ACTION_LABELS: Record<string, string> = {
  "config.updated": "系统配置更新",
  "database.backup.created": "数据库备份创建",
  "database.restore.gate_failed": "还原门禁拦截",
  "database.restore.executed": "数据库还原执行",
  "storage.backup.manual_uploaded": "手动上传云备份",
  "storage.database.restored_from_cloud": "云备份还原数据库",
};

/** 尝试把 details 中的 JSON 数组（配置变更 diff）渲染为「字段：从 → 到」列表 */
function renderDetails(details: string): React.ReactNode {
  if (!details) return <span className="text-gray-400 dark:text-slate-500">—</span>;
  try {
    const parsed = JSON.parse(details);
    if (Array.isArray(parsed) && parsed.every((c) => c && typeof c === "object" && "field" in c)) {
      return (
        <ul className="flex flex-col gap-0.5">
          {parsed.map((c, i) => (
            <li key={i} className="break-all">
              <span className="font-semibold text-gray-700 dark:text-slate-200">{c.field}</span>
              <span className="text-gray-400 dark:text-slate-500">：{String(c.from ?? "")}</span>
              <span className="mx-1 text-[#00C776]">→</span>
              <span className="text-gray-700 dark:text-slate-200">{String(c.to ?? "")}</span>
            </li>
          ))}
        </ul>
      );
    }
  } catch {
    /* 非 JSON，按原文展示 */
  }
  return <span className="break-all text-gray-600 dark:text-slate-300">{details}</span>;
}

export default function AdminAuditLogsPanel() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");

  const fetchLogs = useCallback(async (pageIndex: number, query: string, actionFilter: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(pageIndex * PAGE_SIZE),
      });
      if (query.trim()) params.set("q", query.trim());
      if (actionFilter) params.set("action", actionFilter);
      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "加载审计日志失败");
        return;
      }
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch {
      setError("网络异常，无法加载审计日志");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchLogs(0, "", "");
    });
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const applyFilter = () => {
    setPage(0);
    fetchLogs(0, q, action);
  };

  return (
    <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-6 border border-gray-100/90 dark:border-slate-700 shadow-2xs transition-colors">
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            审计日志 ({total})
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
            记录谁在何时改了什么（系统配置、备份/还原等敏感操作），仅管理员可见
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyFilter(); }}
            placeholder="搜索用户名 / 动作 / 目标…"
            className="h-9 w-48 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:border-[#00C776]"
          />
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-2 text-xs bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none"
          >
            <option value="">全部动作</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            onClick={applyFilter}
            className="h-9 px-4 bg-[#00C776] hover:bg-[#009a5a] text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            筛选
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-xs text-rose-500">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-400 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="pb-3 pr-4">时间</th>
              <th className="pb-3 pr-4">操作者</th>
              <th className="pb-3 pr-4">动作</th>
              <th className="pb-3 pr-4">目标</th>
              <th className="pb-3">变更详情</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400 dark:text-slate-500">加载中…</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400 dark:text-slate-500">暂无审计记录</td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="align-top hover:bg-gray-50/60 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="py-3.5 pr-4 text-gray-400 dark:text-slate-400 whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString("zh-CN")}
                  </td>
                  <td className="py-3.5 pr-4 font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                    {l.username
                      ? `@${l.username}${l.displayName && l.displayName !== l.username ? `（${l.displayName}）` : ""}`
                      : "已删除账号"}
                  </td>
                  <td className="py-3.5 pr-4">
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900 whitespace-nowrap">
                      {ACTION_LABELS[l.action] || l.action}
                    </span>
                  </td>
                  <td className="py-3.5 pr-4 text-gray-600 dark:text-slate-300 whitespace-nowrap">{l.target || "—"}</td>
                  <td className="py-3.5 text-gray-600 dark:text-slate-300 max-w-md">{renderDetails(l.details)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-slate-400">
            第 {page + 1} / {totalPages} 页
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 0 || loading}
              onClick={() => { const next = page - 1; setPage(next); fetchLogs(next, q, action); }}
              className="h-8 px-3 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              上一页
            </button>
            <button
              disabled={page >= totalPages - 1 || loading}
              onClick={() => { const next = page + 1; setPage(next); fetchLogs(next, q, action); }}
              className="h-8 px-3 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
