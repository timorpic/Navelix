"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SiteLink } from "@/types";

export type LinkStatus = "online" | "offline" | "checking" | "unknown";

// 通过服务端代理检测连通性，避免浏览器跨域请求触发 CORB 拦截
async function checkLinks(
  urls: string[],
): Promise<Record<string, LinkStatus>> {
  if (urls.length === 0) return {};
  try {
    const query = urls.map((u) => `url=${encodeURIComponent(u)}`).join("&");
    const res = await fetch(`/api/link-status?${query}`, {
      cache: "no-store",
    });
    if (!res.ok) return {};
    const data = await res.json();
    const map: Record<string, LinkStatus> = {};
    for (const item of Array.isArray(data?.results) ? data.results : []) {
      if (item?.url && (item.status === "online" || item.status === "offline")) {
        map[item.url] = item.status;
      }
    }
    return map;
  } catch {
    return {};
  }
}

export function useLinkStatus(links: SiteLink[], intervalMs = 60000) {
  const [statuses, setStatuses] = useState<Record<string, LinkStatus>>({});
  const checking = useRef(false);

  const checkAll = useCallback(async (list: SiteLink[]) => {
    if (checking.current) return;
    checking.current = true;

    const initial: Record<string, LinkStatus> = {};
    for (const l of list) initial[l.id] = "checking";
    setStatuses(initial);

    // Check in small batches to avoid hammering the network
    for (let i = 0; i < list.length; i += 5) {
      const batch = list.slice(i, i + 5);
      const statusMap = await checkLinks(batch.map((l) => l.url));
      setStatuses((prev) => {
        const next = { ...prev };
        for (const l of batch) {
          const status = statusMap[l.url];
          if (status) next[l.id] = status;
        }
        return next;
      });
    }
    checking.current = false;
  }, []);

  useEffect(() => {
    if (links.length === 0) return;
    checkAll(links);
    const timer = setInterval(() => checkAll(links), intervalMs);
    return () => clearInterval(timer);
  }, [links, checkAll, intervalMs]);

  return {
    statuses,
    refresh: () => checkAll(links),
  };
}
