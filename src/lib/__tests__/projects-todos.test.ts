import { after, it } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db.ts";
import { createProject, deleteProjectCascade } from "../todos-projects.ts";
import { getUserTodos } from "../todo-store.ts";
const userId = "project-roundtrip";
db.prepare("INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, 'hash', ?)").run(userId, userId, Date.now());
after(() => db.prepare("DELETE FROM users WHERE id = ?").run(userId));
it("creates ordered milestones through the domain API and cascades project deletion", () => {
  const project = createProject(userId, { name: "AI Project", todos: [{ title: "Design", dueDate: "2026-10-14", priority: "high" }, { title: "Release", dueDate: "2026-10-16" }] });
  const todos = getUserTodos(userId);
  assert.deepEqual(todos.map(t => [t.title, t.dueDate, t.projectId]), [["Design", "2026-10-14", project.id], ["Release", "2026-10-16", project.id]]);
  deleteProjectCascade(project.id, userId);
  assert.equal(getUserTodos(userId).length, 0);
  assert.equal(db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(project.id, userId), undefined);
});
