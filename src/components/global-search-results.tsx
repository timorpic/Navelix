"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TodoItem } from "@/types";
import { useNavelixConfig } from "@/hooks/use-navelix-config";
import { useNavelixData } from "@/hooks/use-navelix-data";
import type { NotificationItem } from "@/lib/notifications";
import { formatRelativeTime } from "@/lib/notifications";
import { toLocalDateStr } from "@/lib/date-utils";

interface GlobalSearchResultsProps {
  query: string;
  onNavigate: (categoryId: string) => void;
  onClear: () => void;
}

const MAX_PER_SECTION = 8;

/** 多关键词 AND 匹配：每个关键词至少命中一个字段 */
function matchText(keywords: string[], ...fields: string[]): boolean {
  if (!keywords.length) return true;
  return keywords.every((k) =>
    fields.some((f) => f && f.toLowerCase().includes(k)),
  );
}

/** 将命中的关键词高亮为 React 节点 */
function highlight(text: string, keywords: string[]): React.ReactNode {
  if (!text || !keywords.length) return text;
  const escaped = keywords
    .filter((k) => k)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length);
  if (!escaped.length) return text;
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(re);
  return parts.map((part, i) =>
    keywords.some((k) => k && part.toLowerCase() === k.toLowerCase())
      ? (
          <mark
            key={i}
            className="bg-[#00C776]/20 text-[#00C776] dark:text-[#33d68a] rounded px-0.5"
          >
            {part}
          </mark>
        )
      : part,
  );
}

function SectionHeader({
  icon,
  title,
  count,
}: {
  icon: string;
  title: string;
  count: number;
}) {
  if (count <= 0) return null;
  return (
    <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
      <span>{icon}</span>
      <span>{title}</span>
      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-slate-500">
        {count}
      </span>
    </div>
  );
}

function renderLinkIcon(icon: string) {
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
        className="w-8 h-8 shrink-0 rounded-lg object-contain bg-gray-100 dark:bg-slate-800 p-1"
      />
    );
  }
  return <span className="text-xl shrink-0">{icon}</span>;
}

export default function GlobalSearchResults({
  query,
  onNavigate,
  onClear,
}: GlobalSearchResultsProps) {
  const { categories, links, projects } = useNavelixData();
  const { config } = useNavelixConfig();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [tRes, nRes] = await Promise.all([
        fetch("/api/todos"),
        fetch("/api/notifications"),
      ]);
      if (tRes.ok) {
        const tData = await tRes.json();
        if (Array.isArray(tData.todos)) setTodos(tData.todos);
      }
      if (nRes.ok) {
        const nData = await nRes.json();
        if (Array.isArray(nData.notifications))
          setNotifications(nData.notifications);
      }
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }, []);

  // 挂载拉取 + 切回标签页 / 数据变更后刷新，保证搜索时效性
  useEffect(() => {
    queueMicrotask(() => loadData());
    const handleUpdate = () => loadData();
    window.addEventListener("navelix-workspace-updated", handleUpdate);
    window.addEventListener("focus", handleUpdate);
    return () => {
      window.removeEventListener("navelix-workspace-updated", handleUpdate);
      window.removeEventListener("focus", handleUpdate);
    };
  }, [loadData]);

  const keywords = useMemo(
    () =>
      query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean),
    [query],
  );

  // 查询变化时重置键盘选中
  const keywordKey = keywords.join(" ");
  useEffect(() => {
    queueMicrotask(() => setActiveIndex(0));
  }, [keywordKey]);

  const categoryNameMap = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [categories]);

  const matchedLinks = useMemo(() => {
    if (!keywords.length) return [];
    return links
      .filter(
        (l) =>
          matchText(keywords, l.title, l.description, l.url) ||
          matchText(keywords, categoryNameMap.get(l.category) || ""),
      )
      .slice(0, MAX_PER_SECTION);
  }, [links, keywords, categoryNameMap]);

  const matchedTodos = useMemo(() => {
    if (!keywords.length) return [];
    return todos
      .filter((t) => matchText(keywords, t.title, t.assigneeName || ""))
      .slice(0, MAX_PER_SECTION);
  }, [todos, keywords]);

  const matchedProjects = useMemo(() => {
    if (!keywords.length) return [];
    return projects
      .filter((p) =>
        matchText(keywords, p.name, p.description || "", p.status || ""),
      )
      .slice(0, MAX_PER_SECTION);
  }, [projects, keywords]);

  const matchedNotifications = useMemo(() => {
    if (!keywords.length) return [];
    return notifications
      .filter((n) => matchText(keywords, n.title, n.content))
      .slice(0, MAX_PER_SECTION);
  }, [notifications, keywords]);

  const totalCount =
    matchedLinks.length +
    matchedTodos.length +
    matchedProjects.length +
    matchedNotifications.length;

  const handleOpenLink = useCallback(
    (url: string) => {
      if (!url) return;
      window.open(url, config.linkOpenTarget || "_blank");
    },
    [config.linkOpenTarget],
  );

  // 扁平化所有结果，用于键盘导航（↑/↓ 选择、Enter 激活）
  const actions = useMemo(() => {
    const list: { id: string; run: () => void }[] = [];
    matchedLinks.forEach((l) =>
      list.push({ id: `link-${l.id}`, run: () => handleOpenLink(l.url) }),
    );
    matchedTodos.forEach((t) =>
      list.push({
        id: `todo-${t.id}`,
        run: () => onNavigate("feature-calendar"),
      }),
    );
    matchedProjects.forEach((p) =>
      list.push({
        id: `proj-${p.id}`,
        run: () => onNavigate("feature-projects"),
      }),
    );
    matchedNotifications.forEach((n) =>
      list.push({
        id: `notif-${n.id}`,
        run: () => onNavigate("feature-activities"),
      }),
    );
    return list;
  }, [matchedLinks, matchedTodos, matchedProjects, matchedNotifications, handleOpenLink, onNavigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!actions.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % actions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + actions.length) % actions.length);
      } else if (e.key === "Enter") {
        const action = actions[Math.min(activeIndex, actions.length - 1)];
        if (action) {
          e.preventDefault();
          action.run();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, activeIndex]);

  // 键盘选中项滚动到可视区域
  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const priorityBadge = (p: TodoItem["priority"]) => {
    const map: Record<TodoItem["priority"], string> = {
      high: "bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300 border-red-200/60 dark:border-red-800",
      medium:
        "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/60 dark:border-amber-800",
      low: "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200/60 dark:border-sky-800",
    };
    const label: Record<TodoItem["priority"], string> = {
      high: "高",
      medium: "中",
      low: "低",
    };
    return (
      <span
        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${map[p]}`}
      >
        {label[p]}
      </span>
    );
  };

  const sourceBadge = (source: string) => {
    const s = (source || "").toLowerCase();
    const labelMap: Record<string, string> = {
      api: "API推送",
      calendar: "日历日程",
      project: "项目管理",
      dashboard: "数据看板",
      system: "系统",
    };
    const clsMap: Record<string, string> = {
      api: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200/60 dark:border-purple-800",
      calendar:
        "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/60 dark:border-amber-800",
      project:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800",
      dashboard:
        "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200/60 dark:border-blue-800",
      system:
        "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300 border-gray-200/60 dark:border-slate-700",
    };
    return (
      <span
        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${clsMap[s] || clsMap.system}`}
      >
        {labelMap[s] || source || "系统"}
      </span>
    );
  };

  const rowClass = (active: boolean) =>
    `flex items-center gap-3 p-3 text-left rounded-xl border shadow-2xs transition-all cursor-pointer group ${
      active
        ? "bg-[#00C776]/5 border-[#00C776]/60 dark:border-[#00C776]/60"
        : "bg-white/90 dark:bg-slate-900/80 border-gray-200/80 dark:border-slate-800 hover:border-[#00C776]/50 hover:shadow-md"
    }`;

  const suggestedLinks = useMemo(() => {
    const quick = links.filter((l) => l.isQuickAccess);
    const others = links.filter((l) => !l.isQuickAccess);
    return [...quick, ...others].slice(0, 6);
  }, [links]);

  if (!keywords.length) return null;

  return (
    <div className="flex flex-col gap-4 mt-2 animate-fadeIn">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">
          搜索结果（「{query}」）
          {loaded && (
            <span className="ml-2 text-xs font-medium text-gray-400 dark:text-slate-500">
              共 {totalCount} 条
            </span>
          )}
        </h2>
        <button
          onClick={onClear}
          className="text-xs text-[#00C776] hover:underline cursor-pointer"
        >
          清除搜索
        </button>
      </div>

      {!loaded ? (
        <div className="py-10 text-center text-sm text-gray-400 dark:text-slate-500">
          搜索中…
        </div>
      ) : totalCount === 0 ? (
        <div className="py-14 text-center flex flex-col items-center gap-3 rounded-2xl bg-white/90 dark:bg-slate-900/80 border border-gray-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-4xl">🔍</span>
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">
            未找到与「{query}」相关的内容
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500">
            试试更短的关键词，或用空格拆分多个关键词
          </p>
          {suggestedLinks.length > 0 && (
            <div className="w-full max-w-md mt-2">
              <p className="text-xs font-bold text-gray-400 dark:text-slate-500 mb-2">
                你可能想找
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestedLinks.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => handleOpenLink(l.url)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-[#00C776]/10 hover:text-[#00C776] border border-gray-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    {l.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 书签 */}
          {matchedLinks.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionHeader icon="🔖" title="书签" count={matchedLinks.length} />
              <div className="grid gap-2">
                {matchedLinks.map((l) => {
                  const index = actions.findIndex((a) => a.id === `link-${l.id}`);
                  const active = index === activeIndex;
                  return (
                    <button
                      key={l.id}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => handleOpenLink(l.url)}
                      className={rowClass(active)}
                    >
                      {l.icon ? (
                        renderLinkIcon(l.icon)
                      ) : (
                        <span className="w-8 h-8 shrink-0 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-xs text-gray-400 dark:text-slate-500">
                          🔗
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gray-800 dark:text-slate-200 group-hover:text-[#00C776] transition-colors">
                          {highlight(l.title, keywords)}
                        </span>
                        <span className="block truncate text-xs text-gray-400 dark:text-slate-500">
                          {l.url}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400">
                        {categoryNameMap.get(l.category) || "未分类"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* 日程 / 待办 */}
          {matchedTodos.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionHeader icon="📅" title="日程 / 待办" count={matchedTodos.length} />
              <div className="grid gap-2">
                {matchedTodos.map((t) => {
                  const index = actions.findIndex((a) => a.id === `todo-${t.id}`);
                  const active = index === activeIndex;
                  return (
                    <button
                      key={t.id}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => onNavigate("feature-calendar")}
                      className={rowClass(active)}
                    >
                      <span className="w-8 h-8 shrink-0 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-sm">
                        📅
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gray-800 dark:text-slate-200 group-hover:text-[#00C776] transition-colors">
                          {highlight(t.title, keywords)}
                        </span>
                        <span className="block truncate text-xs text-gray-400 dark:text-slate-500">
                          {t.dueDate
                            ? `截止 ${toLocalDateStr(new Date(t.dueDate.replace(/-/g, "/")))}`
                            : "未设置日期"}
                          {t.assigneeName ? ` · 负责人 ${t.assigneeName}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0">{priorityBadge(t.priority)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* 项目 */}
          {matchedProjects.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionHeader icon="🗂️" title="项目" count={matchedProjects.length} />
              <div className="grid gap-2">
                {matchedProjects.map((p) => {
                  const index = actions.findIndex((a) => a.id === `proj-${p.id}`);
                  const active = index === activeIndex;
                  return (
                    <button
                      key={p.id}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => onNavigate("feature-projects")}
                      className={rowClass(active)}
                    >
                      <span
                        className="w-2.5 h-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: p.color || "#00C776" }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gray-800 dark:text-slate-200 group-hover:text-[#00C776] transition-colors">
                          {highlight(p.name, keywords)}
                        </span>
                        <span className="block truncate text-xs text-gray-400 dark:text-slate-500">
                          {p.description || p.status || "暂无描述"}
                        </span>
                      </span>
                      {p.status && (
                        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
                          {p.status}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* 消息 */}
          {matchedNotifications.length > 0 && (
            <section className="flex flex-col gap-2">
              <SectionHeader icon="🔔" title="消息" count={matchedNotifications.length} />
              <div className="grid gap-2">
                {matchedNotifications.map((n) => {
                  const index = actions.findIndex(
                    (a) => a.id === `notif-${n.id}`,
                  );
                  const active = index === activeIndex;
                  return (
                    <button
                      key={n.id}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => onNavigate("feature-activities")}
                      className={rowClass(active)}
                    >
                      <span className="w-8 h-8 shrink-0 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-sm">
                        🔔
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gray-800 dark:text-slate-200 group-hover:text-[#00C776] transition-colors">
                          {highlight(n.title, keywords)}
                        </span>
                        <span className="block truncate text-xs text-gray-400 dark:text-slate-500">
                          {n.content || formatRelativeTime(n.createdAt)}
                        </span>
                      </span>
                      <span className="shrink-0 flex flex-col items-end gap-1">
                        {sourceBadge(n.source || "system")}
                        <span className="text-[10px] text-gray-400 dark:text-slate-500">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
