"use client";

import { useRef, useState } from "react";
import { PRESET_AVATARS, resolveAvatar } from "@/lib/avatars";
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
  const [mode, setMode] = useState<"preset" | "upload">("preset");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="space-y-4">
      {/* 当前选择预览 + 恢复默认 */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800">
          {/* eslint-disable-next-line @next/next/no-img-element -- 头像可能是任意图片地址或 data URL */}
          <img
            src={resolveAvatar(value, username)}
            alt="头像预览"
            className="h-full w-full object-cover"
          />
        </div>
        <button
          type="button"
          onClick={() => onChange("")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
            !value
              ? "border-[#00C776] bg-teal-50 text-[#00C776] dark:bg-teal-950/60"
              : "border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
          }`}
        >
          使用默认头像
        </button>
      </div>

      {/* 类型切换 */}
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-50 dark:bg-slate-800 p-1">
        <button
          type="button"
          onClick={() => setMode("preset")}
          className={`py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
            mode === "preset"
              ? "bg-white shadow-sm text-gray-900 dark:bg-slate-700 dark:text-white"
              : "text-gray-500 dark:text-slate-400"
          }`}
        >
          🎨 系统内置头像
        </button>
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
            mode === "upload"
              ? "bg-white shadow-sm text-gray-900 dark:bg-slate-700 dark:text-white"
              : "text-gray-500 dark:text-slate-400"
          }`}
        >
          📤 上传头像
        </button>
      </div>

      {mode === "preset" ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {PRESET_AVATARS.map((p) => {
            const selected = value === `preset:${p.id}`;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onChange(`preset:${p.id}`)}
                title={p.name}
                className={`flex h-12 items-center justify-center overflow-hidden rounded-full border-2 transition-colors cursor-pointer ${
                  selected
                    ? "border-[#00C776] ring-2 ring-[#00C776]/30"
                    : "border-transparent hover:border-gray-300 dark:hover:border-slate-600"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 内置头像为远程 SVG 小图 */}
                <img
                  src={p.url}
                  alt={p.name}
                  className="h-full w-full object-cover"
                />
              </button>
            );
          })}
        </div>
      ) : (
        <div>
          <input
            ref={fileRef}
            type="file"
            name="avatar-upload"
            accept="image/*"
            aria-label="上传头像图片"
            onChange={handleFile}
            className="w-full text-xs text-gray-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#00C776]/10 file:text-[#009a5a] file:text-xs file:font-semibold file:cursor-pointer cursor-pointer"
          />
          <p className="mt-1 text-[10px] text-gray-400 dark:text-slate-400">
            支持 PNG / JPG / SVG / GIF，自动压缩为 128×128 后保存
          </p>
          {uploading && (
            <p className="mt-1 text-[11px] text-gray-400">处理中…</p>
          )}
        </div>
      )}
    </div>
  );
}
