"use client";

import { useText } from "@/hooks/use-text";
import { useTranslations } from "next-intl";
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
    notes?: string;
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
  const text = useText();
  const tx = useTranslations();
  // State is initialized from props; the parent remounts this modal via a
  // `key` whenever it opens, so no effect is needed to sync form values.
  const [title, setTitle] = useState(link?.title ?? "");
  const [url, setUrl] = useState(link?.url ?? "");
  const [description, setDescription] = useState(link?.description ?? "");
  const [notes, setNotes] = useState(link?.notes ?? "");
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
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");
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
          if (!res.ok) throw new Error(tx("request_failed_126fbf59"));
          const data = await res.json();
          if (cancelled) return;
          setIconifyIcons(
            Array.isArray(data?.icons) ? data.icons : [],
          );
        } catch {
          if (cancelled) return;
          setIconifyIcons([]);
          setIconifyError(tx("iconify_search_failed_check_your_connection_and__a12a53f9"));
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
  }, [iconMode, iconifyQuery, tx]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToIconDataUrl(file);
      setIcon(dataUrl);
      setIconifyError("");
    } catch {
      setIconifyError(tx("failed_to_read_image_try_another_image_747d415e"));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePickIconify = (name: string) => {
    setIcon(iconifyUrl(name));
  };

  const handleFetchSiteIcon = async () => {
    let targetUrl = (customSiteUrl.trim() || url.trim() || link?.url || "").trim();
    if (!targetUrl) {
      setSiteError(tx("enter_a_url_above_or_a_website_url_below_first_9ce6e9bb"));
      return;
    }
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }
    try {
      new URL(targetUrl);
    } catch {
      setSiteError(tx("enter_a_valid_url_e_g_portainer_io_01c417e6"));
      return;
    }

    setSiteLoading(true);
    setSiteError("");
    try {
      const res = await fetch(`/api/favicon?url=${encodeURIComponent(targetUrl)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || tx("failed_to_fetch_website_icon_b6cc76b4"));
      }
      if (data.dataUrl) {
        setIcon(data.dataUrl);
      } else if (data.iconUrl) {
        setIcon(data.iconUrl);
      } else {
        throw new Error(tx("no_website_icon_found_3d44144e"));
      }
    } catch (err) {
      setSiteError(err instanceof Error ? text(err.message) : tx("failed_to_fetch_website_icon_b6cc76b4"));
    } finally {
      setSiteLoading(false);
    }
  };

  const handleSummarize = async () => {
    const targetUrl = url.trim();
    if (!targetUrl) {
      setSummaryError(tx("enter_a_url_first_3cbd5557"));
      return;
    }
    if (!/^https?:\/\//i.test(targetUrl)) {
      setSummaryError(tx("enter_a_complete_http_https_url_50a4eebb"));
      return;
    }
    setSummarizing(true);
    setSummaryError("");
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.notes) {
        setNotes(data.notes);
        if (data.title && !title.trim()) setTitle(data.title);
      } else {
        setSummaryError(data.message || data.error || tx("failed_to_generate_summary_d9488bc2"));
      }
    } catch {
      setSummaryError(tx("network_request_failed_8407ceab"));
    } finally {
      setSummarizing(false);
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
      notes: notes.trim(),
    });
    setError("");
    onClose();
  };

  const isEdit = !!link;
  const inputClass =
    "h-10 w-full rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 bg-white dark:bg-slate-900/60 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

  const iconPreviewText = icon
    ? icon.startsWith("data:")
      ? tx("image_ready_upload_website_icon_fa5036c2")
      : icon.startsWith("https://api.iconify.design/")
        ? tx("iconify_icon_6775db10")
        : icon
    : tx("no_icon_set_c9dab094");

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
          <button
            type="button"
            onClick={handleSummarize}
            disabled={summarizing}
            className="mt-2 w-full py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-brand/10 to-indigo-500/10 hover:from-brand/20 hover:to-indigo-500/20 text-brand border border-brand/25 transition-colors cursor-pointer disabled:opacity-50"
          >
            {summarizing ? tx("fetching_page_and_generating_summary_eead3b28") : tx("generate_markdown_summary_with_ai_04496d16")}
          </button>
          {summaryError && (
            <p className="mt-1 text-[11px] text-red-500">{summaryError}</p>
          )}
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
            {tx("icon_optional_e45153be")}</label>
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
                {tx("clear_bce23772")}</button>
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
              {tx("upload_3c33901a")}</button>
            <button
              type="button"
              onClick={() => setIconMode("iconify")}
              className={`py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                iconMode === "iconify"
                  ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
              }`}
            >
              {tx("iconify_482455e3")}</button>
            <button
              type="button"
              onClick={() => setIconMode("site")}
              className={`py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                iconMode === "site"
                  ? "bg-white dark:bg-slate-700 shadow-sm text-gray-900 dark:text-white"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
              }`}
            >
              {tx("website_icon_8181a793")}</button>
          </div>

          {iconMode === "upload" ? (
            <div key="icon-upload">
              <input
                id="link-upload-file"
                ref={fileInputRef}
                type="file"
                name="link-icon-file"
                accept="image/*"
                aria-label={tx("upload_icon_c2e19f9f")}
                onChange={handleFileChange}
                className="w-full text-xs text-gray-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-brand/10 file:text-brand-strong file:text-xs file:font-semibold file:cursor-pointer cursor-pointer"
              />
              <p className="mt-1 text-[10px] text-gray-400 dark:text-slate-400">
                {tx("supports_png_jpg_svg_gif_resized_to_96_96_before_5e07d9c4")}</p>
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
                aria-label={tx("search_iconify_icons_9e80653f")}
                placeholder={tx("search_icons_e_g_github_home_server_425aff16")}
                className="h-9 w-full rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 bg-white dark:bg-slate-900/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
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
                        ? "border-brand bg-brand/10"
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
                    {tx("searching_cc50237e")}</p>
                )}
                {!iconifyLoading && iconifyError && (
                  <p className="col-span-6 py-2 text-center text-[11px] text-red-400">
                    {iconifyError}
                  </p>
                )}
                {!iconifyLoading && !iconifyError && iconifyIcons.length === 0 && (
                  <p className="col-span-6 py-4 text-center text-[11px] text-gray-400 dark:text-slate-400">
                    {tx("no_matching_icons_9655c6a6")}</p>
                )}
              </div>
              <p className="mt-1 text-[10px] text-gray-400 dark:text-slate-400">
                {tx("icons_from_43eb0bc2")}{" "}
                <a
                  href="https://icon-sets.iconify.design/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {tx("iconify_library_23a6b97b")}</a>
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
                  placeholder={tx("website_or_icon_url_leave_blank_to_use_the_url_a_3d97821a")}
                  aria-label={tx("enter_a_website_url_to_fetch_its_icon_88c038fe")}
                  className="h-9 flex-1 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 bg-white dark:bg-slate-900/60 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                <button
                  type="button"
                  onClick={handleFetchSiteIcon}
                  disabled={siteLoading}
                  className="h-9 shrink-0 rounded-lg bg-brand px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-60 cursor-pointer"
                >
                  {siteLoading ? tx("fetching_146da2e2") : tx("fetch_icon_cefa78df")}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 dark:text-slate-400">
                {tx("fetches_the_favicon_from_the_url_above_by_defaul_dbb96565")}</p>
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
        <div>
          <label
            htmlFor="link-notes"
            className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-slate-400"
          >
            {tx("markdown_notes_ae81304a")}<span className="text-[10px] text-gray-400 dark:text-slate-500">{tx("optional_searchable_a3535261")}</span>
          </label>
          <textarea
            id="link-notes"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={tx("page_highlights_summaries_or_personal_notes_e_g__c048f9eb")}
            rows={4}
            className={`${inputClass} resize-y min-h-[84px]`}
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
            className="h-9 rounded-lg bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-strong"
          >
            {isEdit ? "Save" : "Add Link"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
