import { beforeEach, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { db } from "../db.ts";
import { saveUserConfigs } from "../user-data.ts";
import { saveTelegramSettings, isPersonalTelegramEnabled } from "../user-notifications.ts";
import { createTodo, updateTodoFields, createProject, syncProjectMilestones } from "../todos-projects.ts";
import { enqueueDueReminders, runPersonalTelegramNotifications } from "../personal-telegram.ts";
import { toLocalDateStr } from "../date-utils.ts";
import { migrateV17 } from "../migrations/versions/v17.ts";

const users = ["tg-owner", "tg-assignee", "tg-unrelated"];
const morning = () => { const date = new Date(); date.setHours(10, 0, 0, 0); return date; };
function cleanup() {
  for (const id of users) {
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    db.prepare("DELETE FROM audit_logs WHERE user_id = ?").run(id);
  }
}
beforeEach(() => {
  cleanup();
  for (const id of users) {
    db.prepare("INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, 'hash', 'user', ?)").run(id, id, Date.now());
    saveTelegramSettings(id, { botToken: "test-token", chatId: "123", enabled: true, notifyTodo: true, notifyAssignment: true, notifyDataTransfer: true });
  }
});
after(cleanup);

describe("personal Telegram delivery", () => {
  it("uses each recipient's language while preserving the original task title", async () => {
    saveUserConfigs(users[1], { language: "en" });
    const now = morning();
    createTodo(users[0], { title: "中文任务 English", dueDate: toLocalDateStr(now), assigneeId: users[1] });
    db.prepare("DELETE FROM telegram_deliveries").run();
    const messages = new Map<string, string>();
    await runPersonalTelegramNotifications(now, async (userId, message) => { messages.set(userId, message); return true; });
    assert.match(messages.get(users[0]) ?? "", /今日到期/);
    assert.match(messages.get(users[1]) ?? "", /due today/i);
    for (const message of messages.values()) assert.ok(message.includes("中文任务 English"));
    assert.equal(messages.size, 2);
  });
  it("reminds only owners and assignees, after 09:00, once per task/date even across scheduler runs", async () => {
    const now = morning();
    const id = createTodo(users[0], { title: "due", dueDate: toLocalDateStr(now), assigneeId: users[1] });
    db.prepare("DELETE FROM telegram_deliveries").run(); // separate assignment event from reminder
    const early = new Date(now); early.setHours(8);
    enqueueDueReminders(early);
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM telegram_deliveries").get() as { n: number }).n, 0);
    const sent: string[] = [];
    const sender = async (userId: string) => { sent.push(userId); return true; };
    await runPersonalTelegramNotifications(now, sender);
    await runPersonalTelegramNotifications(now, sender);
    assert.deepEqual(sent.sort(), [users[0], users[1]].sort());
    updateTodoFields(id, { dueDate: toLocalDateStr(new Date(now.getTime() + 86400_000)) });
    await runPersonalTelegramNotifications(new Date(now.getTime() + 86400_000), sender);
    assert.equal(sent.length, 4);
  });
  it("queues new assignments and reassignments, skips unchanged/self assignments, and rechecks ownership", async () => {
    const now = morning();
    const id = createTodo(users[0], { title: "private", assigneeId: users[1] });
    updateTodoFields(id, { title: "renamed" });
    updateTodoFields(id, { assigneeId: users[1] });
    updateTodoFields(id, { assigneeId: users[2] });
    updateTodoFields(id, { assigneeId: users[1] });
    updateTodoFields(id, { assigneeId: users[2] });
    const sent: string[] = [];
    await runPersonalTelegramNotifications(now, async (userId, text) => { sent.push(userId); assert.ok(text.includes("renamed")); return true; });
    assert.deepEqual(sent, [users[2]]);
    updateTodoFields(id, { assigneeId: users[0] });
    await runPersonalTelegramNotifications(now, async userId => { sent.push(userId); return true; });
    assert.equal(sent.length, 1);
  });
  it("covers project milestone creation and edits", async () => {
    const project = createProject(users[0], { name: "project", todos: [{ title: "milestone", assigneeId: users[1] }] });
    const task = db.prepare("SELECT id FROM user_todos WHERE project_id = ?").get(project.id) as { id: string };
    syncProjectMilestones(project.id, users[0], [{ id: task.id, title: "reassigned", assigneeId: users[2] }]);
    const sent: string[] = [];
    await runPersonalTelegramNotifications(morning(), async userId => { sent.push(userId); return true; });
    assert.deepEqual(sent, [users[2]]);
  });
  it("does not persist assignment events when task transaction fails", () => {
    db.exec("CREATE TEMP TRIGGER reject_tg_event BEFORE INSERT ON telegram_deliveries BEGIN SELECT RAISE(ABORT, 'test rollback'); END");
    try {
      assert.throws(() => createTodo(users[0], { title: "rollback", assigneeId: users[1] }), /test rollback/);
      assert.equal(db.prepare("SELECT 1 FROM user_todos WHERE user_id = ?").get(users[0]), undefined);
    } finally { db.exec("DROP TRIGGER reject_tg_event"); }
  });
  it("honors opt-out, completion and deletion after enqueue", async () => {
    const now = morning();
    const id = createTodo(users[0], { title: "disabled", assigneeId: users[1] });
    saveTelegramSettings(users[1], { notifyAssignment: false });
    const done = createTodo(users[0], { title: "done", assigneeId: users[2] });
    updateTodoFields(done, { done: true });
    db.prepare("DELETE FROM user_todos WHERE id = ? AND user_id = ?").run(id, users[0]);
    let count = 0;
    await runPersonalTelegramNotifications(now, async () => { count++; return true; });
    assert.equal(count, 0);
    assert.equal(isPersonalTelegramEnabled(users[1], "assignment"), false);
    assert.equal(isPersonalTelegramEnabled(users[1], "dataTransfer"), true);
    saveTelegramSettings(users[1], { enabled: false });
    assert.equal(isPersonalTelegramEnabled(users[1], "dataTransfer"), false);
  });
  it("leases deliveries across concurrent schedulers and retries failures at most three times", async () => {
    createTodo(users[0], { title: "retry", assigneeId: users[1] });
    const now = morning();
    let attempts = 0;
    const sender = async () => { attempts++; await Promise.resolve(); return false; };
    await Promise.all([runPersonalTelegramNotifications(now, sender), runPersonalTelegramNotifications(now, sender)]);
    assert.equal(attempts, 1);
    await runPersonalTelegramNotifications(new Date(now.getTime() + 5 * 60_000), sender);
    await runPersonalTelegramNotifications(new Date(now.getTime() + 10 * 60_000), sender);
    await runPersonalTelegramNotifications(new Date(now.getTime() + 15 * 60_000), sender);
    assert.equal(attempts, 3);
  });
});

it("v17 upgrades historical subscriptions without opting users in, and is idempotent", () => {
  const old = new DatabaseSync(":memory:");
  try {
    old.exec("CREATE TABLE users (id TEXT PRIMARY KEY); CREATE TABLE user_todos (id TEXT PRIMARY KEY); CREATE TABLE user_notification_settings (user_id TEXT, notify_backup INTEGER, notify_system INTEGER); INSERT INTO user_notification_settings VALUES ('old', 1, 1)");
    migrateV17(old); migrateV17(old);
    const row = old.prepare("SELECT * FROM user_notification_settings").get();
    assert.equal(row?.notify_todo, 0); assert.equal(row?.notify_assignment, 0); assert.equal(row?.notify_data_transfer, 0);
    assert.equal(row?.notify_backup, 1); assert.equal(row?.notify_system, 1);
    assert.ok(old.prepare("SELECT 1 FROM sqlite_master WHERE name = 'telegram_deliveries'").get());
  } finally { old.close(); }
});
