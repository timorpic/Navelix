"use client";

import { useEffect, useState } from "react";
import type { SiteLink } from "@/types";

export function recordLinkUsage(linkId: string) {
  try {
    const raw = localStorage.getItem("navelix.link.usage");
    const usageMap: Record<string, { count: number; lastUsed: number }> = raw
      ? JSON.parse(raw)
      : {};
    const existing = usageMap[linkId] || { count: 0, lastUsed: 0 };
    usageMap[linkId] = {
      count: existing.count + 1,
      lastUsed: Date.now(),
    };
    localStorage.setItem("navelix.link.usage", JSON.stringify(usageMap));
    window.dispatchEvent(new Event("navelix-link-clicked"));
  } catch (e) {
    console.warn("[Navelix] link-usage 记录失败", e);
  }
}

function computeRecentLinks(links: SiteLink[], limit: number): SiteLink[] {
  if (typeof window === "undefined" || !links.length) {
    return links.slice(0, limit);
  }

  try {
    const raw = localStorage.getItem("navelix.link.usage");
    const usageMap: Record<string, { count: number; lastUsed: number }> = raw
      ? JSON.parse(raw)
      : {};

    // Sort links by usage count desc, then lastUsed desc
    const sorted = [...links].sort((a, b) => {
      const usageA = usageMap[a.id] || { count: 0, lastUsed: 0 };
      const usageB = usageMap[b.id] || { count: 0, lastUsed: 0 };
      if (usageB.count !== usageA.count) {
        return usageB.count - usageA.count;
      }
      return usageB.lastUsed - usageA.lastUsed;
    });

    return sorted.slice(0, limit);
  } catch (e) {
    console.warn("[Navelix] link-usage 读取失败", e);
    return links.slice(0, limit);
  }
}

export function useRecentLinks(links: SiteLink[], limit = 5) {
  const [recentLinks, setRecentLinks] = useState<SiteLink[]>(() =>
    computeRecentLinks(links, limit),
  );

  useEffect(() => {
    const handleUpdate = () => setRecentLinks(computeRecentLinks(links, limit));
    window.addEventListener("navelix-link-clicked", handleUpdate);
    return () =>
      window.removeEventListener("navelix-link-clicked", handleUpdate);
  }, [links, limit]);

  return recentLinks;
}
