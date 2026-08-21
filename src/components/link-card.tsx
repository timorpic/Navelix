"use client";

import Image from "next/image";
import type { LinkStatus, LinkProbeInfo } from "@/hooks/use-link-status";
import type { SiteLink } from "@/types";
import { recordLinkUsage } from "@/lib/link-usage";
import { useNavelixConfig } from "@/hooks/use-navelix-config";

interface LinkCardProps {
  link: SiteLink;
  status?: LinkStatus | LinkProbeInfo;
}

const statusDotClass: Record<LinkStatus, string> = {
  online: "bg-emerald-500 ring-2 ring-white dark:ring-slate-900 shadow-xs",
  slow: "bg-amber-400 ring-2 ring-white dark:ring-slate-900 shadow-xs",
  offline: "bg-rose-500 ring-2 ring-white dark:ring-slate-900 shadow-xs",
  checking: "animate-pulse bg-sky-400 ring-2 ring-white dark:ring-slate-900",
  unknown: "bg-gray-300 ring-2 ring-white dark:ring-slate-900",
};

export default function LinkCard({ link, status }: LinkCardProps) {
  const { config } = useNavelixConfig();
  const target = config.linkOpenTarget === "_self" ? "_self" : "_blank";

  const probeInfo: LinkProbeInfo | undefined =
    typeof status === "string" ? { status } : status;
  const currentStatus = probeInfo?.status;
  const latency = probeInfo?.latencyMs;

  const statusTitle =
    currentStatus === "online"
      ? `🟢 服务在线 · ${latency ? `${latency}ms` : "正常"}`
      : currentStatus === "slow"
      ? `🟡 响应缓慢 · ${latency ? `${latency}ms` : "延迟较高"}`
      : currentStatus === "offline"
      ? `🔴 无法连接 (离线或异常)`
      : currentStatus === "checking"
      ? "正在探测连通性与延迟…"
      : "状态未知";

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

  const cardStyle = config.glassmorphism
    ? "backdrop-blur-md bg-white/70 dark:bg-slate-800/70 border-white/40 dark:border-slate-700/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_16px_rgba(0,0,0,0.08)] hover:border-[#00C776]/50"
    : "bg-white dark:bg-slate-800 border-gray-100 dark:border-slate-700 hover:shadow-md hover:border-[#00C776]/40";

  return (
    <a
      href={link.url}
      target={target}
      rel="noopener noreferrer"
      onClick={() => recordLinkUsage(link.id)}
      className={`group flex items-center gap-3 rounded-xl border p-3 transition-all duration-200 cursor-pointer ${cardStyle}`}
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
        {currentStatus && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ${statusDotClass[currentStatus]}`}
            title={statusTitle}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100 transition-colors group-hover:text-[#00C776]">
            {link.title}
          </p>
          {typeof latency === "number" && currentStatus === "online" && (
            <span className="shrink-0 text-[10px] font-mono text-emerald-600 dark:text-emerald-400/90 font-medium bg-emerald-50 dark:bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-200/50 dark:border-emerald-900/50">
              {latency}ms
            </span>
          )}
          {typeof latency === "number" && currentStatus === "slow" && (
            <span className="shrink-0 text-[10px] font-mono text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/60 px-1 py-0.2 rounded border border-amber-200/50 dark:border-amber-900/50">
              {latency}ms
            </span>
          )}
        </div>
        <p className="truncate text-xs text-gray-400 dark:text-slate-400">{link.description}</p>
      </div>
    </a>
  );
}
