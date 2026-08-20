import type { CodexUsage } from "./model-monitor-types";

export function formatRelative(ts: number): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "刚刚";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
  return `${Math.floor(diff / 86400_000)} 天前`;
}

export function formatResetTime(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = t - Date.now();
  if (diff <= 0) return "已到重置时间";
  const days = Math.floor(diff / 86400_000);
  const hours = Math.floor((diff % 86400_000) / 3600_000);
  const mins = Math.floor((diff % 3600_000) / 60_000);
  if (days > 0) return `${days} 天 ${hours} 小时后重置`;
  return hours > 0 ? `${hours} 小时 ${mins} 分后重置` : `${mins} 分钟后重置`;
}

export function codexWindowLabel(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "窗口";
  const days = seconds / 86400;
  if (Math.abs(days - 365) < 1) return "1Y";
  if (Math.abs(days - 30) < 1) return "30D";
  if (Math.abs(days - 7) < 1) return "7D";
  if (Math.abs(days - 1) < 0.1) return "24H";
  const hours = seconds / 3600;
  if (Math.abs(hours - 5) < 0.1) return "5H";
  if (days >= 1) return `${Math.round(days)}D`;
  return `${Math.round(hours)}H`;
}

export function codexLimitText(usage: CodexUsage): string {
  const label = codexWindowLabel(usage.primaryWindow?.windowSeconds ?? null);
  if (label === "30D") return "月耗尽";
  if (label === "7D") return "周耗尽";
  return "已耗尽";
}