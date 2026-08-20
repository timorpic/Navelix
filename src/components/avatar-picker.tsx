"use client";

import { useId, useMemo, useRef, useState } from "react";
import {
  AVATAR_STYLE_OPTIONS,
  PRESET_AVATARS,
  buildAvatarUrl,
  resolveAvatar,
} from "@/lib/avatars";
import { fileToDataUrl } from "@/lib/image-utils";

interface AvatarPickerProps {
  value: string;
  username?: string;
  onChange: (value: string) => void;
}

export default function AvatarPicker({
  value,
  username,
  onChange,
}: AvatarPickerProps) {
  const [mode, setMode] = useState<"preset" | "generator" | "custom">("preset");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [generatorStyle, setGeneratorStyle] = useState<string>("notionists");
  const [randomSalt, setRandomSalt] = useState<number>(1);
  const [customUrlInput, setCustomUrlInput] = useState<string>(
    value && !value.startsWith("preset:") && !value.startsWith("data:") ? value : "",
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarUrlInputId = useId();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file, 128);
      onChange(dataUrl);
    } catch {
      // ignore
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrlInput.trim()) {
      onChange(customUrlInput.trim());
    }
  };

  // 生成器：根据选定风格和随机种子实时生成 6 个各不相同的头像候选项
  const generatedCandidates = useMemo(() => {
    const baseSeed = (username || "User").trim();
    const candidateSeeds = [
      `${baseSeed}-${randomSalt}-alpha`,
      `${baseSeed}-${randomSalt}-beta`,
      `${baseSeed}-${randomSalt}-gamma`,
      `${baseSeed}-${randomSalt}-delta`,
      `${baseSeed}-${randomSalt}-epsilon`,
      `${baseSeed}-${randomSalt}-zeta`,
    ];
    return candidateSeeds.map((seed, i) => ({
      id: `gen-${generatorStyle}-${i}-${randomSalt}`,
      url: buildAvatarUrl(generatorStyle, seed),
    }));
  }, [generatorStyle, randomSalt, username]);

  const filteredPresets = useMemo(() => {
    if (activeCategory === "all") return PRESET_AVATARS;
    return PRESET_AVATARS.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  return (
    <div className="space-y-4">
      {/* 1. 当前选择预览 + 恢复默认 */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/70 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-emerald-400/50 bg-white dark:bg-slate-800 shadow-xs">
            {/* eslint-disable-next-line @next/next/no-img-element -- 头像支持外部 URL 或 data URL */}
            <img
              src={resolveAvatar(value, username)}
              alt="头像预览"
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900 dark:text-white">
              {value.startsWith("preset:")
                ? "使用系统精选头像"
                : value.startsWith("data:")
                ? "使用本地上传图片"
                : value
                ? "使用在线自定义图片"
                : "使用默认智能手绘头像"}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
              可随时切换风格、随机生成或上传个性照片
            </p>
          </div>
        </div>

        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setCustomUrlInput("");
            }}
            className="rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:text-rose-500 hover:border-rose-200 transition-colors cursor-pointer"
          >
            恢复默认
          </button>
        )}
      </div>

      {/* 2. 模式切换三 Tab */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 dark:bg-slate-800/80 p-1">
        <button
          type="button"
          onClick={() => setMode("preset")}
          className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            mode === "preset"
              ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-2xs"
              : "text-gray-500 dark:text-slate-400 hover:text-gray-800"
          }`}
        >
          🎨 精选风格库
        </button>
        <button
          type="button"
          onClick={() => setMode("generator")}
          className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            mode === "generator"
              ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-2xs"
              : "text-gray-500 dark:text-slate-400 hover:text-gray-800"
          }`}
        >
          🎲 智能生成器
        </button>
        <button
          type="button"
          onClick={() => setMode("custom")}
          className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            mode === "custom"
              ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-2xs"
              : "text-gray-500 dark:text-slate-400 hover:text-gray-800"
          }`}
        >
          📤 上传与 URL
        </button>
      </div>

      {/* 3.1 模式 A：精选高颜值风格库 */}
      {mode === "preset" && (
        <div className="space-y-3">
          {/* 分类筛选 Chips */}
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {[
              { id: "all", label: "全部" },
              { id: "notion", label: "Notion 手绘" },
              { id: "adventurer", label: "精致插画" },
              { id: "anime", label: "二次元美型" },
              { id: "cute", label: "3D 萌系" },
              { id: "robot", label: "科技机器人" },
              { id: "geometric", label: "艺术几何" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  activeCategory === cat.id
                    ? "bg-[#00C776] text-white"
                    : "bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-100"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* 头像列表 */}
          <div className="grid grid-cols-6 gap-2 max-h-56 overflow-y-auto p-1">
            {filteredPresets.map((p) => {
              const selected = value === `preset:${p.id}` || value === p.url;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChange(`preset:${p.id}`)}
                  title={p.name}
                  className={`group relative aspect-square overflow-hidden rounded-full border-2 transition-all cursor-pointer p-0.5 ${
                    selected
                      ? "border-[#00C776] ring-2 ring-[#00C776]/30 scale-105"
                      : "border-gray-100 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-slate-500"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- 内置头像 */}
                  <img
                    src={p.url}
                    alt={p.name}
                    className="h-full w-full rounded-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3.2 模式 B：在线智能生成器 */}
      {mode === "generator" && (
        <div className="space-y-3.5 rounded-2xl bg-gray-50/50 dark:bg-slate-900/30 p-3.5 border border-gray-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-gray-700 dark:text-slate-300">
                生成风格：
              </label>
              <select
                name="avatarStyle"
                value={generatorStyle}
                onChange={(e) => setGeneratorStyle(e.target.value)}
                className="h-8 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-medium text-gray-800 dark:text-slate-200"
              >
                {AVATAR_STYLE_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setRandomSalt((prev) => prev + 1)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-[#00C776] hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-bold transition-colors cursor-pointer"
            >
              <span>🎲</span>
              <span>换一批随机生成</span>
            </button>
          </div>

          <div className="grid grid-cols-6 gap-2 pt-1">
            {generatedCandidates.map((c, i) => {
              const isCurrent = value === c.url;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChange(c.url)}
                  title={`点击应用候选头像 ${i + 1}`}
                  className={`group relative aspect-square overflow-hidden rounded-full border-2 transition-all cursor-pointer p-0.5 ${
                    isCurrent
                      ? "border-[#00C776] ring-2 ring-[#00C776]/30 scale-105"
                      : "border-gray-200 dark:border-slate-700 hover:border-emerald-400"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.url}
                    alt={`候选头像 ${i + 1}`}
                    className="h-full w-full rounded-full object-cover"
                  />
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center">
            点击任意一个生成的头像即可直接应用为你的账号头像
          </p>
        </div>
      )}

      {/* 3.3 模式 C：自定义网络 URL / 本地上传 */}
      {mode === "custom" && (
        <div className="space-y-4">
          {/* 网络图片 URL */}
          <form onSubmit={handleApplyCustomUrl} className="space-y-2">
            <label
              htmlFor={avatarUrlInputId}
              className="block text-xs font-bold text-gray-700 dark:text-slate-300"
            >
              网络图片直链 URL
            </label>
            <div className="flex gap-2">
              <input
                id={avatarUrlInputId}
                type="url"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder="https://example.com/my-avatar.png (支持 GitHub/QQ/Gravatar 头像)"
                className="flex-1 h-9 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-gray-900 dark:text-white"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-[#00C776] hover:bg-[#009a5a] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
              >
                应用链接
              </button>
            </div>
          </form>

          {/* 本地上传 */}
          <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
            <label
              htmlFor="avatar-local-upload"
              className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1"
            >
              本地图片上传
            </label>
            <input
              id="avatar-local-upload"
              ref={fileRef}
              type="file"
              name="avatar-upload"
              accept="image/*"
              aria-label="上传头像图片"
              onChange={handleFile}
              className="w-full text-xs text-gray-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#00C776]/10 file:text-[#009a5a] file:text-xs file:font-semibold file:cursor-pointer cursor-pointer"
            />
            <p className="mt-1 text-[10px] text-gray-400 dark:text-slate-400">
              支持 PNG / JPG / SVG / WebP，上传后自动智能压缩为 128×128 本地保存
            </p>
            {uploading && (
              <p className="mt-1 text-[11px] text-emerald-500 font-medium">
                正在处理压缩头像…
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
