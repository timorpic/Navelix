"use client";

// 相对时间格式化统一由 lib/date-utils.ts 提供（保持此导出以兼容既有导入）
export { formatRelativeTime } from "../date-utils.ts";

export interface NotificationItem {
  id: string;
  title: string;
  content: string;
  source?: string;
  createdAt: number;
  read: boolean;
}

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
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, source }),
    });
  } catch {
    // 通知失败不影响操作本身
  }
}

