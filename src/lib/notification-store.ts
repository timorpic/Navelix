import { randomBytes } from "node:crypto";
import { db } from "./db.ts";

/**
 * 通知/活动记录的领域读写（下沉自 api/notifications 三个路由）。
 *
 * 下沉动机：同一个 `notifications` 表的行映射与字段拼装在三个路由里各写一遍
 * （`toNotification` 只在 GET 用、POST 又手工拼了一次返回体；`[id]` 路由自己
 * 维护字段白名单）。这里收敛为单一来源，路由只负责鉴权与状态码。
 */

export interface NotificationRow {
  id: string;
  title: string;
  content: string;
  source?: string;
  created_at: number;
  read: number;
}

export interface PublicNotification {
  id: string;
  title: string;
  content: string;
  source: string;
  createdAt: number;
  read: boolean;
}

export function toPublicNotification(row: NotificationRow): PublicNotification {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    source: row.source || "system",
    createdAt: row.created_at,
    read: row.read === 1,
  };
}

/**
 * 当前用户的操作记录，最新在前（上限 50 条，与前端列表容量一致）。
 *
 * `created_at` 由 `Date.now()` 生成，只有毫秒精度：同一毫秒内写入的多条通知
 * 该列完全相同，而 SQLite 对并列行不保证稳定顺序（实测会让「最新在前」偶发
 * 颠倒，界面上的顺序也会跳变）。`id` 是随机十六进制、不可用作次序依据，因此
 * 以 `rowid`（SQLite 隐式自增，等于插入顺序）作为并列时的 tiebreaker。
 */
export function listNotifications(userId: string): PublicNotification[] {
  const rows = db
    .prepare(
      `SELECT id, title, content, source, created_at, read
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC, rowid DESC
       LIMIT 50`,
    )
    .all(userId) as unknown as NotificationRow[];
  return rows.map(toPublicNotification);
}

export function countUnread(userId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read = 0")
    .get(userId) as { c: number };
  return row.c;
}

export interface CreateNotificationInput {
  title: unknown;
  content?: unknown;
  /** 兼容旧字段名 tag / category */
  source?: unknown;
  tag?: unknown;
  category?: unknown;
}

/** 写入一条通知并返回其公开表示（含生成的 id 与时间戳）。 */
export function createNotification(
  userId: string,
  input: CreateNotificationInput,
): PublicNotification {
  const title = String(input.title ?? "").trim();
  const content = String(input.content ?? "").trim();
  const source = String(
    input.source || input.tag || input.category || "system",
  ).trim();

  const id = randomBytes(16).toString("hex");
  const createdAt = Date.now();
  db.prepare(
    `INSERT INTO notifications (id, user_id, title, content, source, created_at, read)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
  ).run(id, userId, title, content, source, createdAt);

  return {
    id,
    title,
    content,
    source,
    createdAt,
    read: false,
  };
}

export interface NotificationPatchInput {
  title?: unknown;
  content?: unknown;
  read?: unknown;
  source?: unknown;
}

/**
 * 局部更新一条通知。返回 false 表示入参没有任何可更新字段
 * （调用方据此返回 400「无更新内容」）。
 */
export function patchNotification(
  id: string,
  userId: string,
  input: NotificationPatchInput,
): boolean {
  const fields: string[] = [];
  const vals: (string | number)[] = [];

  if (input.title !== undefined) {
    fields.push("title = ?");
    vals.push(String(input.title).trim());
  }
  if (input.content !== undefined) {
    fields.push("content = ?");
    vals.push(String(input.content).trim());
  }
  if (input.read !== undefined) {
    fields.push("read = ?");
    vals.push(input.read ? 1 : 0);
  }
  if (input.source !== undefined) {
    fields.push("source = ?");
    vals.push(String(input.source).trim());
  }

  if (fields.length === 0) return false;

  vals.push(id, userId);
  db.prepare(
    `UPDATE notifications SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
  ).run(...vals);
  return true;
}

export function deleteNotification(id: string, userId: string): void {
  db.prepare("DELETE FROM notifications WHERE id = ? AND user_id = ?").run(id, userId);
}

export function deleteAllNotifications(userId: string): void {
  db.prepare("DELETE FROM notifications WHERE user_id = ?").run(userId);
}

export function markAllRead(userId: string): void {
  db.prepare("UPDATE notifications SET read = 1 WHERE user_id = ?").run(userId);
}
