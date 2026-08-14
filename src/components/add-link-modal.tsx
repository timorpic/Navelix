"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/modal";
import BrandIcon from "@/components/brand-icon";
import type { Category, SiteLink } from "@/types";

interface AddLinkModalProps {
  open: boolean;
  link?: SiteLink | null;
  defaultCategory?: string;
  categories: Category[];
  onClose: () => void;
  onAdd: (linkData: {
    title: string;
    url: string;
    description: string;
    category: string;
    icon: string;
  }) => void;
}

// 常用流行图标备选（Iconify 在线模式未搜索时的默认推荐，包含 Tabler / Material / Iconoir 等经典库）
const CURATED_ICONS = [
  "simple-icons:github",
  "simple-icons:google",
  "tabler:palette",
  "tabler:sparkles",
  "tabler:app-window",
  "tabler:server",
  "tabler:device-desktop",
  "material-symbols:home-outline",
  "material-symbols:settings-outline",
  "material-symbols:dashboard-outline",
  "iconoir:design-nib",
  "iconoir:server",
  "simple-icons:bilibili",
  "simple-icons:youtube",
  "simple-icons:docker",
  "simple-icons:linux",
  "simple-icons:apple",
  "simple-icons:windows",
  "simple-icons:chatgpt",
  "simple-icons:openai",
  "simple-icons:baidu",
  "simple-icons:wechat",
  "simple-icons:qq",
  "simple-icons:telegram",
];

const ICONIFY_SEARCH_API = "https://api.iconify.design/search?limit=30&query=";

function iconifyUrl(name: string): string {
  const [prefix, iconName] = name.split(":");
  if (prefix && iconName) {
    return `https://api.iconify.design/${prefix}/${iconName}.svg`;
  }
  return `https://api.iconify.design/${name}.svg`;
}

// 图片文件自动缩放转 Data URL，并限制尺寸最高 96x96
function fileToIconDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("解析图片失败"));
      img.onload = () => {
        const maxSize = 96;
        let w = img.width;
        let h = img.height;

        if (w > maxSize || h > maxSize) {
          if (w > h) {
            h = Math.round((h * maxSize) / w);
            w = maxSize;
          } else {
            w = Math.round((w * maxSize) / h);
            h = maxSize;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, w);
        canvas.height = Math.max(1, h);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function AddLinkModal({
  open,
  link,
  defaultCategory,
  categories,
  onClose,
  onAdd,
}: AddLinkModalProps) {
  // State is initialized from props; the parent remounts this modal via a
  // `key` whenever it opens, so no effect is needed to sync form values.
  const [title, setTitle] = useState(link?.title ?? "");
  const [url, setUrl] = useState(link?.url ?? "");
  const [description, setDescription] = useState(link?.description ?? "");
  const [category, setCategory] = useState(
    link?.category ?? defaultCategory ?? "",
  );
  const [icon, setIcon] = useState(link?.icon ?? "");
  const [iconMode, setIconMode] = useState<"upload" | "iconify" | "site">(
    link?.icon?.startsWith("https://api.iconify.design/") ? "iconify" : "upload",
  );
  const [iconifyQuery, setIconifyQuery] = useState("");
  const [iconifyIcons, setIconifyIcons] = useState<string[]>(CURATED_ICONS);
  const [iconifyLoading, setIconifyLoading] = useState(false);
  const [iconifyError, setIconifyError] = useState("");
  const [customSiteUrl, setCustomSiteUrl] = useState("");
  const [siteLoading, setSiteLoading] = useState(false);
  const [siteError, setSiteError] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounced Iconify search; empty query shows curated defaults.
  useEffect(() => {
    if (iconMode !== "iconify") return;
    const q = iconifyQuery.trim();
    let cancelled = false;

    const timer = setTimeout(
      async () => {
        if (cancelled) return;
        if (!q) {
          setIconifyIcons(CURATED_ICONS);
          setIconifyLoading(false);
          setIconifyError("");
          return;
        }
        setIconifyLoading(true);
        setIconifyError("");
        try {
          const res = await fetch(ICONIFY_SEARCH_API + encodeURIComponent(q));
          if (!res.ok) throw new Error("请求失败");
          const data = await res.json();
          if (cancelled) return;
          setIconifyIcons(
            Array.isArray(data?.icons) ? data.icons : [],
          );
        } catch {
          if (cancelled) return;
          setIconifyIcons([]);
          setIconifyError("Iconify 搜索失败，请检查网络后重试");
        } finally {
          if (!cancelled) setIconifyLoading(false);
        }
      },
      q ? 300 : 0,
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [iconMode, iconifyQuery]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToIconDataUrl(file);
      setIcon(dataUrl);
      setIconifyError("");
    } catch {
      setIconifyError("图片读取失败，请换一张图片重试");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePickIconify = (name: string) => {
    setIcon(iconifyUrl(name));
  };

  const handleFetchSiteIcon = async () => {
    let targetUrl = (customSiteUrl.trim() || url.trim() || link?.url || "").trim();
    if (!targetUrl) {
      setSiteError("请先在上方填写网址或在下方输入官网链接");
      return;
    }
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }
    try {
      new URL(targetUrl);
    } catch {
      setSiteError("请输入正确的网址（如 portainer.io）");
      return;
    }

    setSiteLoading(true);
    setSiteError("");
    try {
      const res = await fetch(`/api/favicon?url=${encodeURIComponent(targetUrl)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "获取网站图标失败");
      }
      if (data.dataUrl) {
        setIcon(data.dataUrl);
      } else if (data.iconUrl) {
        setIcon(data.iconUrl);
      } else {
        throw new Error("未找到网站图标");
      }
    } catch (err) {
      setSiteError(err instanceof Error ? err.message : "获取网站图标失败");
    } finally {
      setSiteLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    let normalizedUrl = url.trim();

    if (!trimmedTitle || !normalizedUrl) {
      setError("Title and URL are required");
      return;
    }
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    try {
      new URL(normalizedUrl);
    } catch {
      setError("Please enter a valid URL");
      return;
    }

    const targetCategory = category || categories[0]?.id || "";
    if (!targetCategory) {
      setError("Please create a category first");
      return;
    }

    onAdd({
      title: trimmedTitle,
      url: normalizedUrl,
      description: description.trim(),
      category: targetCategory,
      icon: icon.trim(),
    });
    setError("");
    onClose();
  };

  const isEdit = !!link;
  const inputClass =
    "h-10 w-full rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 bg-white dark:bg-slate-900/60 transition-colors focus:border-[#00C776] focus:outline-none focus:ring-2 focus:ring-[#00C776]/20";

  const iconPreviewText = icon
    ? icon.startsWith("data:")
      ? "已获取图片（本地上传 / 网站图标）"
      : icon.startsWith("https://api.iconify.design/")
        ? "Iconify 在线图标"
        : icon
    : "未设置图标";

  return (
    <Modal
      open={open}
      title={isEdit ? "Edit Link" : "Add Link"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="link-title"
            className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-slate-400"
          >
            Title *
          </label>
          <input
            id="link-title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. GitHub"
            className={inputClass}
            autoFocus
          />
        </div>
        <div>
          <label
            htmlFor="link-url"
            className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-slate-400"
          >
            URL *
          </label>
          <input
            id="link-url"
            name="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="e.g. https://github.com"
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="link-category"
            className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-slate-400"
          >
            Category *
          </label>
          <select
            id="link-category"
            name="category"
            value={category || categories[0]?.id || ""}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
          >
            {categories.length === 0 && (
              <option value="">No categories yet</option>
            )}
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-slate-400">
            Icon（可选）
          </label>
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700">
              <BrandIcon name={icon || title || "N"} className="w-6 h-6" />
            </div>
            <span className="flex-1 break-all text-[11px] text-gray-400 dark:text-slate-400">
              {iconPreviewText}
            </span>
            {icon && (
              <button
                type="button"
                onClick={() => setIcon("")}
                className="text-[11px] text-red-400 hover:text-red-600 cursor-pointer"
              >
                清除
              </button>
            )}
          </div>

          <div className="mb-2 grid grid-cols-3 gap-1 rounded-lg bg-gray-50 dark:bg-slate-800/80 p-1">
            <button
              type="button"
              onClick={() => setIconMode("upload")}
              className={`py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                iconMode === "upload"
                  ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
              }`}
            >
              📁 本地上传
            </button>
            <button
              type="button"
              onClick={() => setIconMode("iconify")}
              className={`py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                iconMode === "iconify"
                  ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
              }`}
            >
              🌐 Iconify 在线
            </button>
            <button
              type="button"
              onClick={() => setIconMode("site")}
              className={`py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                iconMode === "site"
                  ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
              }`}
            >
              🖼️ 网站图标
            </button>
          </div>

          {iconMode === "upload" ? (
            <div key="icon-upload">
              <input
                id="link-upload-file"
                ref={fileInputRef}
                type="file"
                name="link-icon-file"
                accept="image/*"
                aria-label="上传本地图标"
                onChange={handleFileChange}
                className="w-full text-xs text-gray-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[#00C776]/10 file:text-[#009a5a] file:text-xs file:font-semibold file:cursor-pointer cursor-pointer"
              />
              <p className="mt-1 text-[10px] text-gray-400 dark:text-slate-400">
                支持 PNG / JPG / SVG / GIF，自动压缩为 96×96 后保存
              </p>
            </div>
          ) : iconMode === "iconify" ? (
            <div key="icon-iconify">
              <input
                id="link-icon"
                name="iconify-search"
                type="text"
                value={iconifyQuery}
                onChange={(e) => setIconifyQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
                aria-label="搜索 Iconify 图标"
                placeholder="搜索图标，如 github、home、server…"
                className="h-9 w-full rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 bg-white dark:bg-slate-900/60 focus:border-[#00C776] focus:outline-none focus:ring-2 focus:ring-[#00C776]/20"
              />
              <div className="mt-2 grid max-h-40 grid-cols-6 gap-1.5 overflow-y-auto">
                {iconifyIcons.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handlePickIconify(name)}
                    title={name}
                    className={`flex h-9 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                      icon === iconifyUrl(name)
                        ? "border-[#00C776] bg-[#00C776]/10"
                        : "border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- 远程 SVG 图标，尺寸小无需优化 */}
                    <img
                      src={iconifyUrl(name)}
                      alt={name}
                      className="h-5 w-5"
                    />
                  </button>
                ))}
                {iconifyLoading && (
                  <p className="col-span-6 py-4 text-center text-[11px] text-gray-400 dark:text-slate-400">
                    搜索中…
                  </p>
                )}
                {!iconifyLoading && iconifyError && (
                  <p className="col-span-6 py-2 text-center text-[11px] text-red-400">
                    {iconifyError}
                  </p>
                )}
                {!iconifyLoading && !iconifyError && iconifyIcons.length === 0 && (
                  <p className="col-span-6 py-4 text-center text-[11px] text-gray-400 dark:text-slate-400">
                    未找到相关图标
                  </p>
                )}
              </div>
              <p className="mt-1 text-[10px] text-gray-400 dark:text-slate-400">
                图标来自{" "}
                <a
                  href="https://icon-sets.iconify.design/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Iconify 图标库
                </a>
              </p>
            </div>
          ) : (
            <div key="icon-site" className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  id="custom-site-icon-url"
                  name="custom-site-icon-url"
                  type="text"
                  value={customSiteUrl}
                  onChange={(e) => setCustomSiteUrl(e.target.value)}
                  placeholder="输入官网或图标网址（留空则从上方 URL 抓取）"
                  aria-label="输入官网或自定义网址抓取图标"
                  className="h-9 flex-1 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 bg-white dark:bg-slate-900/60 focus:border-[#00C776] focus:outline-none focus:ring-2 focus:ring-[#00C776]/20"
                />
                <button
                  type="button"
                  onClick={handleFetchSiteIcon}
                  disabled={siteLoading}
                  className="h-9 shrink-0 rounded-lg bg-[#00C776] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#009a5a] disabled:opacity-60 cursor-pointer"
                >
                  {siteLoading ? "获取中…" : "抓取图标"}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-slate-400">
                默认从上方 URL 自动获取 favicon；若为内网 IP，可在此输入其官网（如 portainer.io）提取官方图标
              </p>
              {siteError && (
                <p className="text-[11px] text-red-400">{siteError}</p>
              )}
            </div>
          )}
        </div>
        <div>
          <label
            htmlFor="link-description"
            className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-slate-400"
          >
            Description
          </label>
          <input
            id="link-description"
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional short description"
            className={inputClass}
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg px-4 text-sm font-medium text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-9 rounded-lg bg-[#00C776] px-5 text-sm font-medium text-white transition-colors hover:bg-[#009a5a]"
          >
            {isEdit ? "Save" : "Add Link"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
