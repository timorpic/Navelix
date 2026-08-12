"use client";

import { useState } from "react";
import Modal from "./modal";
import type { Category } from "@/types";

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
  onAdd: (name: string, icon: string) => void;
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
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Category name is required");
      return;
    }
    onAdd(name.trim(), icon);
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
          <label className="mb-1.5 block text-xs font-medium text-gray-500">
            Icon
          </label>
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
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg px-4 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
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
      </form>
    </Modal>
  );
}
