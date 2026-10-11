import { randomUUID } from "node:crypto";
import { db } from "./db.ts";
import { toLocalDateStr } from "./date-utils.ts";
import { isPersonalTelegramEnabled, type PersonalTelegramKind } from "./user-notifications.ts";
import { sendUserTelegramNotification } from "./telegram.ts";

interface TaskRow {
  id: string; user_id: string; title: string; done: number; due_date: string;
  assignee_id: string; assigned_to: string;
}
interface Delivery {
  event_key: string; user_id: string; owner_id: string; todo_id: string;
  kind: "todo" | "assignment"; due_date: string; attempts: number;
}
const assignee = (task: TaskRow) => task.assignee_id || task.assigned_to || "";

/** Capture before/after inside the caller's write transaction so rollbacks also discard events. */
interface AssignmentSnapshot {
  ownerId?: string;
  todoId?: string;
  recipients: Map<string, string>;
}
function assignmentTasks(scope: { ownerId?: string; todoId?: string }): TaskRow[] {
  return db.prepare("SELECT * FROM user_todos WHERE (? IS NULL OR user_id = ?) AND (? IS NULL OR id = ?)")
    .all(scope.ownerId ?? null, scope.ownerId ?? null, scope.todoId ?? null, scope.todoId ?? null) as unknown as TaskRow[];
}
export function captureTaskAssignments(scope: { ownerId?: string; todoId?: string }): AssignmentSnapshot {
  return { ...scope, recipients: new Map(assignmentTasks(scope)
    .map(task => [JSON.stringify([task.user_id, task.id]), assignee(task)])) };
}
export function enqueueChangedAssignments(before: AssignmentSnapshot): void {
  for (const task of assignmentTasks(before)) {
    const recipient = assignee(task);
    if (before.recipients.get(JSON.stringify([task.user_id, task.id])) === recipient) continue;
    // Supersede undelivered assignments, including reassignment away and back before the next tick.
    db.prepare("UPDATE telegram_deliveries SET finished = 1 WHERE owner_id = ? AND todo_id = ? AND kind = 'assignment' AND finished = 0")
      .run(task.user_id, task.id);
    if (!recipient || recipient === task.user_id) continue;
    if (!isPersonalTelegramEnabled(recipient, "assignment")) continue;
    enqueue(randomUUID(), recipient, task, "assignment");
  }
}
function enqueue(key: string, recipient: string, task: TaskRow, kind: Delivery["kind"]): void {
  db.prepare(`INSERT OR IGNORE INTO telegram_deliveries
    (event_key, user_id, owner_id, todo_id, kind, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(key, recipient, task.user_id, task.id, kind, task.due_date, Date.now());
}

/** Calendar and todos share date-only rows. Remind once per recipient/date after 09:00 server time. */
export function enqueueDueReminders(now = new Date()): void {
  if (now.getHours() < 9) return;
  const today = toLocalDateStr(now);
  const tasks = db.prepare("SELECT * FROM user_todos WHERE done = 0 AND due_date = ?").all(today) as unknown as TaskRow[];
  for (const task of tasks) {
    for (const recipient of new Set([task.user_id, assignee(task)].filter(Boolean))) {
      if (!isPersonalTelegramEnabled(recipient, "todo")) continue;
      enqueue(JSON.stringify(["due", task.user_id, task.id, today, recipient]), recipient, task, "todo");
    }
  }
}

type PersonalSender = (userId: string, text: string, kind: PersonalTelegramKind) => Promise<boolean>;
/** Atomic lease prevents concurrent workers from sending the same pending event. Failed sends retry up to 3 times. */
export async function runPersonalTelegramNotifications(now = new Date(), send: PersonalSender = sendUserTelegramNotification): Promise<void> {
  enqueueDueReminders(now);
  const timestamp = now.getTime();
  db.prepare("DELETE FROM telegram_deliveries WHERE created_at < ?").run(timestamp - 30 * 86400_000);
  const pending = db.prepare(`SELECT * FROM telegram_deliveries WHERE finished = 0 AND next_attempt <= ? AND attempts < 3
    ORDER BY created_at LIMIT 50`).all(timestamp) as unknown as Delivery[];
  for (const event of pending) {
    const claim = db.prepare(`UPDATE telegram_deliveries SET next_attempt = ?, attempts = attempts + 1
      WHERE event_key = ? AND finished = 0 AND next_attempt <= ? AND attempts < 3`)
      .run(timestamp + 5 * 60_000, event.event_key, timestamp);
    if (!claim.changes) continue;
    const task = db.prepare("SELECT * FROM user_todos WHERE id = ? AND user_id = ?").get(event.todo_id, event.owner_id) as unknown as TaskRow | undefined;
    const related = task && (event.user_id === task.user_id || event.user_id === assignee(task));
    const valid = related && !task.done && (event.kind === "assignment"
      ? event.user_id === assignee(task)
      : task.due_date === event.due_date && event.due_date === toLocalDateStr(now));
    if (!valid || !isPersonalTelegramEnabled(event.user_id, event.kind)) {
      db.prepare("UPDATE telegram_deliveries SET finished = 1 WHERE event_key = ?").run(event.event_key);
      continue;
    }
    const text = event.kind === "assignment"
      ? `📌 Navelix：你收到一项任务\n${task.title.slice(0, 500)}${task.due_date ? `\n截止日期：${task.due_date}` : ""}`
      : `📅 Navelix：待办 / 日历今日到期\n${task.title.slice(0, 500)}\n截止日期：${task.due_date}`;
    let sent = false;
    try { sent = await send(event.user_id, text, event.kind); } catch { /* retry without leaking transport credentials */ }
    if (sent || event.attempts + 1 >= 3) {
      db.prepare("UPDATE telegram_deliveries SET finished = 1 WHERE event_key = ?").run(event.event_key);
    }
  }
}
