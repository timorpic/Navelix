"use client";

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
