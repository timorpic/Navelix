"use client";

import Image from "next/image";
import type { LinkStatus } from "@/hooks/use-link-status";
import type { SiteLink } from "@/types";
import { recordLinkUsage } from "@/lib/link-usage";

interface LinkCardProps {
  link: SiteLink;
  status?: LinkStatus;
}

const statusDotClass: Record<LinkStatus, string> = {
  online: "bg-green-500",
  offline: "bg-red-500",
  checking: "animate-pulse bg-amber-400",
  unknown: "bg-gray-300",
};

export default function LinkCard({ link, status }: LinkCardProps) {
  let domain = link.url;
  try {
    domain = new URL(link.url).hostname.replace(/^www\./, "");
  } catch {
    // keep raw url as fallback
  }
  const customIcon =
    link.icon && (link.icon.startsWith("data:") || /^https?:\/\//i.test(link.icon))
      ? link.icon
      : null;

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => recordLinkUsage(link.id)}
      className="group flex items-center gap-3 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 transition-all duration-200 hover:border-[#00C776]/40 hover:shadow-md cursor-pointer"
    >
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-lg">
        {customIcon ? (
          // eslint-disable-next-line @next/next/no-img-element -- 自定义图标可能是 data URL，无法使用 next/image
          <img
            src={customIcon}
            alt=""
            className="h-5 w-5 object-contain"
          />
        ) : (
          <Image
            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
            alt=""
            width={20}
            height={20}
            className="h-5 w-5"
            unoptimized
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${link.title}&backgroundColor=14b8a6`;
            }}
          />
        )}
        {status && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-800 ${statusDotClass[status]}`}
            title={status}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100 transition-colors group-hover:text-[#00C776]">
          {link.title}
        </p>
        <p className="truncate text-xs text-gray-400 dark:text-slate-400">{link.description}</p>
      </div>
    </a>
  );
}
