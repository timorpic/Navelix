"use client";

export interface NotificationItem {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  read: boolean;
}

// 后台操作后写入一条通知（前台铃铛展示）
export async function pushNotification(title: string, content: string) {
  try {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
  } catch {
    // 通知失败不影响操作本身
  }
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "刚刚";
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`;
  return new Date(timestamp).toLocaleDateString("zh-CN");
}
