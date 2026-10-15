"use client";

import { parseNotificationFeed } from "../workspace-notifications.ts";

// 相对时间格式化统一由 lib/date-utils.ts 提供（保持此导出以兼容既有导入）
export { formatRelativeTime } from "../date-utils.ts";

export type { NotificationItem } from "../workspace-notifications.ts";

/**
 * 后台操作或业务模块触发时写入一条通知，声明来源模块：
 * @param title 通知标题
 * @param content 详细内容
 * @param source 来源标识：'api' (API推送) | 'calendar' (日历日程) | 'project' (项目管理) | 'dashboard' (数据看板) | 'system' (系统设置)
 */
export async function pushNotification(
  title: string,
  content: string,
  source: "api" | "calendar" | "project" | "system" | string = "system",
) {
  try {
    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, source }),
    });
    if (response.ok) window.dispatchEvent(new Event("navelix-notifications-updated"));
  } catch {
    // 通知失败不影响操作本身
  }
}

/** The feed is shared by the header and the home activity strip. */
export async function fetchNotificationFeed(signal: AbortSignal) {
  const response = await fetch("/api/notifications", { signal });
  if (response.status === 401) return { notifications: [], unreadCount: 0 };
  if (!response.ok) throw new Error("Notification request failed");
  return parseNotificationFeed(await response.json());
}

export async function markAllNotificationsRead(): Promise<void> {
  const response = await fetch("/api/notifications/read", { method: "POST" });
  if (!response.ok) throw new Error("Mark notifications read failed");
  window.dispatchEvent(new Event("navelix-notifications-updated"));
}

/** Notify all workspace consumers after an activity record is removed. */
export async function deleteNotificationRecords(id?: string): Promise<void> {
  const response = await fetch(id === undefined ? "/api/notifications" : `/api/notifications/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Delete notification failed");
  window.dispatchEvent(new Event("navelix-notifications-updated"));
}
