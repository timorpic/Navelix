"use client";

import { useState, useEffect, useCallback } from "react";

interface TeamCategory {
  id: string;
  name: string;
  label: string;
  icon: string;
  color: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  linkCount: number;
  isOwner: boolean;
  isSubscribed: boolean;
}

interface TeamCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
}

export default function TeamCategoriesModal({
  isOpen,
  onClose,
  onRefreshData,
}: TeamCategoriesModalProps) {
  const [categories, setCategories] = useState<TeamCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchTeamCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/categories/team");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.categories)) {
          setCategories(data.categories);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => {
        fetchTeamCategories();
      });
    }
  }, [isOpen, fetchTeamCategories]);

  if (!isOpen) return null;

  const handleToggleSubscribe = async (cat: TeamCategory) => {
    const key = `${cat.ownerId}:${cat.id}`;
    setActionInProgress(key);
    try {
      const action = cat.isSubscribed ? "unsubscribe" : "subscribe";
      const res = await fetch("/api/categories/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: cat.id,
          ownerId: cat.ownerId,
          action,
        }),
      });
      if (res.ok) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === cat.id && c.ownerId === cat.ownerId
              ? { ...c, isSubscribed: !c.isSubscribed }
              : c,
          ),
        );
        onRefreshData?.();
      }
    } catch {
      // ignore
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">👥</span>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                团队共享分类大厅
              </h2>
              <p className="text-xs text-gray-400 dark:text-slate-400 mt-0.5">
                发现并订阅团队成员公开的精选书签分类，实时同步挂载至个人工作台
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* List Content */}
        <div className="p-5 overflow-y-auto flex-1 divide-y divide-gray-100 dark:divide-slate-700/60">
          {loading ? (
            <div className="py-12 text-center text-xs text-gray-400">
              正在加载团队分类…
            </div>
          ) : categories.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">
              暂无团队公开分类。您可以在分类设置中勾选「公开给团队成员」分享您的收藏。
            </div>
          ) : (
            categories.map((cat) => {
              const key = `${cat.ownerId}:${cat.id}`;
              const isProcessing = actionInProgress === key;

              return (
                <div
                  key={key}
                  className="py-3.5 flex items-center justify-between gap-4 hover:bg-gray-50/50 dark:hover:bg-slate-700/30 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">{cat.icon || "📂"}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                          {cat.name}
                        </span>
                        {cat.isOwner && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 font-semibold border border-emerald-200/60 dark:border-emerald-800">
                            我创建的
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400 dark:text-slate-400">
                        <span>由 @{cat.ownerName} 提供</span>
                        <span>•</span>
                        <span>{cat.linkCount} 个链接</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {cat.isOwner ? (
                      <span className="text-xs text-gray-400 px-3 py-1.5">已拥有</span>
                    ) : (
                      <button
                        onClick={() => handleToggleSubscribe(cat)}
                        disabled={isProcessing}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          cat.isSubscribed
                            ? "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                            : "bg-[#00C776] text-white hover:bg-[#009a5a] shadow-xs"
                        }`}
                      >
                        {isProcessing
                          ? "处理中…"
                          : cat.isSubscribed
                          ? "已订阅 · 取消"
                          : "+ 订阅到侧栏"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 dark:bg-slate-800/60 border-t border-gray-100 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-slate-200 text-xs font-semibold rounded-xl hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
