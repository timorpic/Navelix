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
  signal: AbortSignal,
): Promise<Record<string, LinkProbeInfo>> {
  if (urls.length === 0) return {};
  try {
    const query = urls.map((u) => `url=${encodeURIComponent(u)}`).join("&");
    const res = await fetch(`/api/link-status?${query}`, {
      cache: "no-store",
      signal,
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
  const active = useRef<AbortController | null>(null);

  const checkAll = useCallback(async (list: SiteLink[]) => {
    if (!enabled || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    const { signal } = controller;
    const initial: Record<string, LinkProbeInfo> = {};
    for (const link of list) initial[link.id] = { status: "checking" };
    setStatuses(initial);
    try {
      for (let i = 0; i < list.length && !signal.aborted; i += 6) {
        const batch = list.slice(i, i + 6);
        const statusMap = await checkLinks(batch.map(link => link.url), signal);
        if (signal.aborted) return;
        setStatuses(prev => {
          const next = { ...prev };
          for (const link of batch) next[link.id] = statusMap[link.url] ?? { status: "unknown" };
          return next;
        });
      }
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !links.length) return;
    void checkAll(links);
    const timer = setInterval(() => { if (!document.hidden) void checkAll(links); }, Math.max(1000, intervalMs));
    return () => {
      clearInterval(timer);
      active.current?.abort();
      active.current = null;
    };
  }, [links, checkAll, intervalMs, enabled]);

  return {
    statuses: enabled && links.length ? statuses : {},
    refresh: () => checkAll(links),
  };
}
