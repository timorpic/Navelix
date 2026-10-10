"use client";

import { useState } from "react";
import Modal from "./modal";
import Toast from "./toast";
import type { Category } from "@/types";
import { copyShareLink } from "@/lib/share-link";
import { useToast } from "@/hooks/use-toast";

const EMOJI_OPTIONS = [
  "📁",
  "🤖",
  "🎨",
  "💻",
  "📚",
  "📰",
  "🔧",
  "💬",
  "🌿",
  "⭐",
  "🧠",
  "⚡",
  "🗂️",
  "🌐",
];

interface AddCategoryModalProps {
  open: boolean;
  category?: Category | null;
  onClose: () => void;
  onAdd: (name: string, icon: string, isTeamShared?: boolean) => void;
}

export default function AddCategoryModal({
  open,
  category,
  onClose,
  onAdd,
}: AddCategoryModalProps) {
  // Parent remounts this modal via `key` on open, so props are the source of truth.
  const [name, setName] = useState(category?.name ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "📁");
  const [isTeamShared, setIsTeamShared] = useState(category?.isTeamShared ?? false);
  const [error, setError] = useState("");
  const { notice, flash } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Category name is required");
      return;
    }
    onAdd(name.trim(), icon, isTeamShared);
    setError("");
    onClose();
  };

  const isEdit = !!category;

  return (
    <Modal
      open={open}
      title={isEdit ? "Edit Category" : "Add Category"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="category-name"
            className="mb-1.5 block text-xs font-medium text-gray-500"
          >
            Category Name *
          </label>
          <input
            id="category-name"
            name="categoryName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Finance"
            className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-[#00C776] focus:outline-none focus:ring-2 focus:ring-[#00C776]/20"
            autoFocus
          />
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-gray-500">
            Icon
          </span>
          <div className="flex flex-wrap gap-2">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setIcon(emoji)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-all ${
                  icon === emoji
                    ? "border-[#00C776] bg-[#00C776]/10"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* 团队共享勾选 */}
        <div className="pt-1">
          <label className="flex items-center gap-2.5 text-xs text-gray-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isTeamShared}
              onChange={(e) => setIsTeamShared(e.target.checked)}
              className="w-4 h-4 rounded text-[#00C776] focus:ring-[#00C776]/30 cursor-pointer"
            />
            <span className="font-semibold">👥 设为团队公开分类（允许其他团队成员订阅挂载）</span>
          </label>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}
        <Toast message={notice} className="mb-3" />
        <div className="flex items-center justify-between gap-3 pt-2">
          {isEdit && category ? (
            <button
              type="button"
              onClick={async () => {
                const r = await copyShareLink("category", category.id, category.name);
                flash(r.message);
              }}
              className="inline-flex items-center gap-1 text-xs text-[#00C776] hover:text-[#009a5a] font-medium py-1 px-2 rounded hover:bg-[#00C776]/10 transition-colors"
            >
              🔗 复制分享链接
            </button>
          ) : <div />}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg px-4 text-sm font-medium text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 rounded-lg bg-[#00C776] px-5 text-sm font-medium text-white transition-colors hover:bg-[#009a5a]"
            >
              {isEdit ? "Save" : "Add Category"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
