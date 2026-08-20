"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SiteLink } from "@/types";

export type LinkStatus = "online" | "slow" | "offline" | "checking" | "unknown";

export interface LinkProbeInfo {
  status: LinkStatus;
  latencyMs?: number;
  statusCode?: number;
}

export function getStatusType(s?: LinkStatus | LinkProbeInfo): LinkStatus {
  if (!s) return "unknown";
  if (typeof s === "string") return s;
  return s.status || "unknown";
}

// 通过服务端代理检测连通性与网络延迟，避免浏览器跨域请求触发 CORB 拦截
async function checkLinks(
  urls: string[],
): Promise<Record<string, LinkProbeInfo>> {
  if (urls.length === 0) return {};
  try {
    const query = urls.map((u) => `url=${encodeURIComponent(u)}`).join("&");
    const res = await fetch(`/api/link-status?${query}`, {
      cache: "no-store",
    });
    if (!res.ok) return {};
    const data = await res.json();
    const map: Record<string, LinkProbeInfo> = {};
    for (const item of Array.isArray(data?.results) ? data.results : []) {
      if (item?.url && item.status) {
        map[item.url] = {
          status: item.status,
          latencyMs: item.latencyMs,
          statusCode: item.statusCode,
        };
      }
    }
    return map;
  } catch {
    return {};
  }
}

export function useLinkStatus(links: SiteLink[], intervalMs = 60000, enabled = true) {
  const [statuses, setStatuses] = useState<Record<string, LinkProbeInfo>>({});
  const checking = useRef(false);

  const checkAll = useCallback(async (list: SiteLink[]) => {
    if (!enabled || checking.current) return;
    checking.current = true;

    const initial: Record<string, LinkProbeInfo> = {};
    for (const l of list) initial[l.id] = { status: "checking" };
    setStatuses(initial);

    // 分批探测，避免瞬间并发过高
    for (let i = 0; i < list.length; i += 6) {
      const batch = list.slice(i, i + 6);
      const statusMap = await checkLinks(batch.map((l) => l.url));
      setStatuses((prev) => {
        const next = { ...prev };
        for (const l of batch) {
          const info = statusMap[l.url];
          if (info) next[l.id] = info;
        }
        return next;
      });
    }
    checking.current = false;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || links.length === 0) return;
    checkAll(links);
    const timer = setInterval(() => checkAll(links), intervalMs);
    return () => clearInterval(timer);
  }, [links, checkAll, intervalMs, enabled]);

  return {
    statuses,
    refresh: () => checkAll(links),
  };
}
