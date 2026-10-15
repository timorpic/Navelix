export interface NotificationItem {
  id: string;
  title: string;
  content: string;
  source?: string;
  createdAt: number;
  read: boolean;
}

export interface WorkspaceNotificationFeed {
  notifications: NotificationItem[];
  unreadCount: number;
}

/** Validate the HTTP contract before exposing notifications to the workspace. */
export function parseNotificationFeed(value: unknown): WorkspaceNotificationFeed {
  if (!value || typeof value !== "object") throw new Error("Invalid notification feed");
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.notifications) || typeof data.unreadCount !== "number" || !Number.isSafeInteger(data.unreadCount) || data.unreadCount < 0) throw new Error("Invalid notification feed");
  const notifications = data.notifications.map((item: unknown): NotificationItem => {
    if (!item || typeof item !== "object") throw new Error("Invalid notification");
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.title !== "string" || typeof row.content !== "string" || typeof row.createdAt !== "number" || !Number.isFinite(row.createdAt) || typeof row.read !== "boolean") throw new Error("Invalid notification");
    return { id: row.id, title: row.title, content: row.content, createdAt: row.createdAt, read: row.read, ...(typeof row.source === "string" ? { source: row.source } : {}) };
  });
  return { notifications, unreadCount: data.unreadCount };
}
