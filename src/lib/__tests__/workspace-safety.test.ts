import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { db, seedUserData } from "../db.ts";
import { getUserData, saveUserCategories, saveUserLinks, saveUserTodos } from "../user-data.ts";
import { createProject, createTodo, updateTodoFields, syncProjectMilestones } from "../todos-projects.ts";
import { getUserTodos, resolveTodoOwner } from "../todo-store.ts";
import { getWorkspaceRevision, requireWorkspaceRevision, WorkspaceConflictError } from "../workspace-revision.ts";
import { stageDelete, consumePendingDelete } from "../ai-tools.ts";

const a = "safety-a", b = "safety-b";
for (const id of [a, b]) db.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, 'hash', ?)").run(id, id, Date.now());
after(() => { for (const id of [a, b]) db.prepare("DELETE FROM users WHERE id = ?").run(id); });

describe("workspace isolation regressions", () => {
  it("updates only the requested owner when IDs collide, including project timestamps", () => {
    for (const owner of [a, b]) {
      db.prepare("INSERT INTO projects (id, user_id, name, status, updated_at) VALUES ('shared-id', ?, 'P', '进行中', 0)").run(owner);
      saveUserTodos(owner, [{ id: "same", title: owner, projectId: "shared-id" }]);
    }
    assert.equal(resolveTodoOwner("same", a), a);
    assert.equal(resolveTodoOwner("same", a, b), null);
    updateTodoFields("same", a, { done: true });
    assert.equal(db.prepare("SELECT done FROM user_todos WHERE id='same' AND user_id=?").get(b)?.done, 0);
    assert.equal(db.prepare("SELECT updated_at FROM projects WHERE id='shared-id' AND user_id=?").get(b)?.updated_at, 0);
    createTodo(a, { title: "touch only own project", projectId: "shared-id" });
    assert.equal(db.prepare("SELECT updated_at FROM projects WHERE id='shared-id' AND user_id=?").get(b)?.updated_at, 0);
  });
  it("uses the same delegated task query for Provider and API; milestone assignees can resolve ownership", () => {
    const project = createProject(a, { name: "Delegation", todos: [{ title: "milestone", assigneeId: b }] });
    const task = getUserTodos(b).find(t => t.projectId === project.id);
    assert.ok(task?.isDelegated);
    assert.equal(task.ownerId, a);
    assert.equal(resolveTodoOwner(task.id, b, a), a);
    assert.ok(getUserData(b).todos.some(t => t.id === task.id));
    assert.equal(db.prepare("SELECT assigned_to FROM user_todos WHERE id=? AND user_id=?").get(task.id, a)?.assigned_to, b);
    syncProjectMilestones(project.id, a, [{ title: "new", assigneeId: b }]);
    const inserted = getUserTodos(b).find(t => t.title === "new");
    assert.ok(inserted);
    assert.equal(db.prepare("SELECT assigned_to FROM user_todos WHERE id=? AND user_id=?").get(inserted.id, a)?.assigned_to, b);
  });
  it("does not reseed empty workspace or overwrite existing default projects on read", () => {
    seedUserData(b);
    db.prepare("UPDATE projects SET name='custom' WHERE id='p1' AND user_id=?").run(b);
    saveUserCategories(b, []); saveUserLinks(b, []);
    const data = getUserData(b);
    assert.equal(data.categories.length, 0); assert.equal(data.links.length, 0);
    assert.equal(data.projects.find(p => p.id === "p1")?.name, "custom");
  });
  it("preserves shared provenance, avoids ID collisions/copying, and revokes reads immediately", () => {
    for (const owner of [a, b]) {
      saveUserCategories(owner, [{ id: "cat", name: owner, isTeamShared: true }]);
      saveUserLinks(owner, [{ id: "link", title: owner, url: "https://example.com", category: "cat" }]);
    }
    db.prepare("INSERT INTO user_category_subscriptions (user_id, category_id, owner_id, created_at) VALUES (?, 'cat', ?, ?)").run(b, a, Date.now());
    const data = getUserData(b);
    assert.equal(new Set(data.categories.map(c => c.id)).size, 2);
    assert.equal(new Set(data.links.map(l => l.id)).size, 2);
    const shared = data.links.find(l => l.isSubscribed);
    assert.equal(shared?.ownerId, a); assert.equal(shared?.sourceId, "link");
    saveUserCategories(b, data.categories); saveUserLinks(b, data.links);
    assert.equal(db.prepare("SELECT count(*) AS n FROM user_links WHERE user_id=?").get(b)?.n, 1);
    assert.equal(db.prepare("SELECT title FROM user_links WHERE id='link' AND user_id=?").get(b)?.title, b);
    saveUserCategories(a, [{ id: "cat", name: "private", isTeamShared: false }]);
    assert.equal(getUserData(b).links.some(l => l.ownerId === a), false);
    assert.equal(getUserData(b).categories.some(c => c.isSubscribed), false);
  });
  it("rejects stale full snapshots inside the write transaction", () => {
    const revision = getWorkspaceRevision(a);
    db.exec("BEGIN IMMEDIATE");
    requireWorkspaceRevision(a, revision);
    saveUserLinks(a, [{ id: "new", title: "new", url: "https://example.com", category: "cat" }]);
    db.exec("COMMIT");
    db.exec("BEGIN IMMEDIATE");
    try { assert.throws(() => requireWorkspaceRevision(a, revision), WorkspaceConflictError); }
    finally { db.exec("ROLLBACK"); }
    assert.ok(db.prepare("SELECT 1 FROM user_links WHERE id='new' AND user_id=?").get(a));
    assert.throws(() => requireWorkspaceRevision(a, undefined), WorkspaceConflictError);
  });
});

describe("AI delete confirmation", () => {
  const stage = (conversation: string) => {
    saveUserTodos(a, [{ id: "pending", title: "Keep" }]);
    const result = stageDelete(a, { tool: "delete_todo", args: { id: "pending" } }, conversation);
    assert.ok("needsConfirmation" in result);
    const confirmation = result.message.match(/确认删除 [a-f0-9]{8}/)?.[0];
    assert.ok(confirmation); return confirmation;
  };
  it("rejects questions, broad affirmatives and other conversations; accepts only the issued code", () => {
    const code = stage("chat-a");
    for (const prompt of ["删除是什么意思？", "好的", "yes", "确认删除", "确认删除 deadbeef"]) assert.equal(consumePendingDelete(a, prompt, "chat-a"), null);
    assert.equal(consumePendingDelete(a, code, "chat-b"), null);
    assert.equal(consumePendingDelete(b, code, "chat-a"), null);
    assert.ok(consumePendingDelete(a, code, "chat-a")?.ok);
    assert.equal(db.prepare("SELECT 1 FROM user_todos WHERE id='pending' AND user_id=?").get(a), undefined);
  });
  it("cancel clears pending state, even a subsequent valid code cannot delete", () => {
    const code = stage("cancel-chat");
    assert.ok(consumePendingDelete(a, "取消", "cancel-chat")?.ok);
    assert.equal(consumePendingDelete(a, code, "cancel-chat"), null);
    assert.ok(db.prepare("SELECT 1 FROM user_todos WHERE id='pending' AND user_id=?").get(a));
  });
});
