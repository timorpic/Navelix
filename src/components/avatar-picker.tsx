"use client";

import { useTranslations } from "next-intl";
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
  const tx = useTranslations();
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
              alt={tx("avatar_preview_d416b006")}
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900 dark:text-white">
              {value.startsWith("preset:")
                ? tx("choose_a_curated_avatar_26bb7c5f")
                : value.startsWith("data:")
                ? tx("upload_a_local_image_c0f989d4")
                : value
                ? tx("use_an_image_url_6a66c7e6")
                : tx("use_the_default_generated_avatar_f315351b")}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-slate-400 mt-0.5">
              {tx("choose_a_style_generate_a_random_avatar_or_uploa_cbfe3768")}</p>
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
            {tx("reset_to_default_ba2e93e7")}</button>
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
          {tx("curated_styles_deaa15d2")}</button>
        <button
          type="button"
          onClick={() => setMode("generator")}
          className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            mode === "generator"
              ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-2xs"
              : "text-gray-500 dark:text-slate-400 hover:text-gray-800"
          }`}
        >
          {tx("generator_4cd0c301")}</button>
        <button
          type="button"
          onClick={() => setMode("custom")}
          className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            mode === "custom"
              ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-2xs"
              : "text-gray-500 dark:text-slate-400 hover:text-gray-800"
          }`}
        >
          {tx("upload_url_a36dce37")}</button>
      </div>

      {/* 3.1 模式 A：精选高颜值风格库 */}
      {mode === "preset" && (
        <div className="space-y-3">
          {/* 分类筛选 Chips */}
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {[
              { id: "all", label: tx("all_5c55a679") },
              { id: "notion", label: tx("notion_sketches_ef351cb8") },
              { id: "adventurer", label: tx("illustrations_49ab14e3") },
              { id: "anime", label: tx("anime_09ba441a") },
              { id: "cute", label: tx("3d_cute_6c8f603e") },
              { id: "robot", label: tx("robots_45c7cca9") },
              { id: "geometric", label: tx("geometric_art_0d4e728b") },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  activeCategory === cat.id
                    ? "bg-brand text-white"
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
                      ? "border-brand ring-2 ring-brand/30 scale-105"
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
                {tx("style_ec1b2fa9")}</label>
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-brand hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-bold transition-colors cursor-pointer"
            >
              <span>🎲</span>
              <span>{tx("generate_another_batch_fca2fe10")}</span>
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
                  title={tx("message_b2d2d8348d02", {v0: i + 1})}
                  className={`group relative aspect-square overflow-hidden rounded-full border-2 transition-all cursor-pointer p-0.5 ${
                    isCurrent
                      ? "border-brand ring-2 ring-brand/30 scale-105"
                      : "border-gray-200 dark:border-slate-700 hover:border-emerald-400"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.url}
                    alt={tx("message_8c4a41dd883c", {v0: i + 1})}
                    className="h-full w-full rounded-full object-cover"
                  />
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-400 dark:text-slate-500 text-center">
            {tx("click_any_generated_avatar_to_apply_it_to_your_a_f022ae1a")}</p>
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
              {tx("direct_image_url_efeae7d0")}</label>
            <div className="flex gap-2">
              <input
                id={avatarUrlInputId}
                type="url"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder={tx("https_example_com_my_avatar_png_github_qq_gravat_6f1d4207")}
                className="flex-1 h-9 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs text-gray-900 dark:text-white"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-brand hover:bg-brand-strong text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
              >
                {tx("apply_url_213f5505")}</button>
            </div>
          </form>

          {/* 本地上传 */}
          <div className="pt-2 border-t border-gray-100 dark:border-slate-800">
            <label
              htmlFor="avatar-local-upload"
              className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1"
            >
              {tx("upload_local_image_3ef52813")}</label>
            <input
              id="avatar-local-upload"
              ref={fileRef}
              type="file"
              name="avatar-upload"
              accept="image/*"
              aria-label={tx("upload_avatar_e2ab9635")}
              onChange={handleFile}
              className="w-full text-xs text-gray-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand/10 file:text-brand-strong file:text-xs file:font-semibold file:cursor-pointer cursor-pointer"
            />
            <p className="mt-1 text-[10px] text-gray-400 dark:text-slate-400">
              {tx("supports_png_jpg_svg_webp_resized_to_128_128_bef_3ad5249e")}</p>
            {uploading && (
              <p className="mt-1 text-[11px] text-emerald-500 font-medium">
                {tx("processing_avatar_f8b38bb7")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
